/*
 * (c) CGX 2018
 * Nperf2 performance testing
 * Pascal Guislain
*/

/*nperf modified so that it can be used as a node js library instead of command line*/
/*original source: https://github.com/zanchin/node-http-perf*/

var http = require('http');
var https = require('https');
var util = require('util');
var path = require('path');
var url = require('url');
var fs = require('fs');
var url = require('url');
var colors = require('colors');
var async = require('async');
var urljoin = require('url-join');

const Text = 'text';

const Targets = "targets";
const Concurrency = "concurrency";
const Requests = "requests";
const Verbose = "verbose";
const Dryrun = "dryrun";
const Help = "help";
const Conf = "conf";
const Period = "period";
const Defaults = "defaults";
const Root = "root";
const Extra = "extra";

class Nperf2Runner {

    constructor(callback, log, getTargetCallback) {
        Nperf2Runner._defaults = null; //fix: remove the defaults as the only way to wipe them out was to restart the server
        this.params = {};
        this.stats = {};
        this.responseReceived = 0;
        if (callback) this.completionCallback = callback;
        if (log) this.log = log;
        if (getTargetCallback) this.getTarget = getTargetCallback;
    }

    static get defaults() {
        if (Nperf2Runner._defaults) return Nperf2Runner._defaults;
        //seed default values so that we can run with only targets set from request URL
        Nperf2Runner._defaults = {};
        Nperf2Runner._defaults[Concurrency] = 5;
        Nperf2Runner._defaults[Requests] = 10;
        Nperf2Runner._defaults[Period] = 100;
        return Nperf2Runner._defaults;
    }

    static set defaults(value) { Nperf2Runner._defaults = value; }

    get verbose() { return Nperf2Runner.defaults.verbose === true; }

    log(s) { console.log(s); }

    logObject(o) {
        for (const key of Object.keys(o)) {
            const val = o[key];
            this.log(`${key}: ${val}`);
        }
    }

    static readConfigurationFiles(params, callback) {
        //expects {conf:001,...} or {conf:[001,002]} in the params passed in
        //the params passed in may also contain target(s) and if so will be run separately
        var allParams = [params];
        if (params.conf) {
            var conf = params.conf;
            if (!(conf.substr(0, 2) === "./")) {
                conf = `./conf/${Conf}.${conf}.json`;
            }

            if (!(conf.substr(0, 7) === "./conf/")) {
                conf = `./conf/${conf.substr(2)}`;
            }

            console.log(`Trying to set params from conf file: ${conf}`);

            var f = path.resolve(conf);
            fs.readFile (f, 'utf8', function (err, data) {
                if (err) return callback(null, err);
                var prmf = JSON.parse(data);
                var prmfArray = Array.isArray(prmf) ? prmf : [prmf];
                for (var i = 0; i < prmfArray.length; i++) {
                    var prmfa = prmfArray[i];
                    allParams.push(prmfa);
                }
                return callback(allParams);
            });
        }
    }

    logUsage() {
        var s = `\n${Targets}: Target(s) URL\n`;
        s += `${Conf}: config file - e.g.: './conf.json', 'foo' (converted to: './conf.foo.json')\n`;
        s += `${Concurrency}: Number of concurrent requests threads\n`;
        s += `${Requests}: Max number of total requests\n`;
        s += `${Verbose}: Verbose output\n`;
        s += `${Defaults}: Persist parameters as defaults settings\n`;
        s += `${Root}: Root URL\n`;
        s += `${Period}: the interval b/w each requests defaults to ms unless specified as s e.g.: 100, "100ms", "1s"\n`;
        s += `${Period} can also be an array in which case the value will be randomized b/w min and max e.g.: ["100ms","1s"]`;
        s += `${Extra}: Custom parameters\n`;
        s += `${Dryrun}: Read config, but don't run\n`;
        s += `${Help}: Print this usage and exit\n`;
        this.log(s);
    }

    setParams(params) {

        var isEmpty = function (value) {
            return (value == null || value.length === 0);
        };

        var getDefinedValues = function (obj) {
            var o = {};
            for (const key of Object.keys(obj)) {
                const val = obj[key];
                if (isEmpty(val)) continue;
                o[key] = val;
            }
            return o;
        };

        //replace existing params
        this.params = Object.assign({}, params);

        //update defaults if needed
        //defaults can be set incrementally since we don't wipe them out when getting new default params
        if (params.defaults) {
            var prms = Object.assign({}, params);
            delete prms[Defaults];
            delete prms[Conf];
            prms = getDefinedValues(prms);
            Object.assign(Nperf2Runner.defaults, prms);
            if (this.verbose) this.log("Updated defaults: " + this.getParamsLogTruncated(Nperf2Runner.defaults));
        }

        //if verbose is set on any param set, set it on defaults
        if (params.verbose === true) Nperf2Runner.defaults.verbose = true;

        //set all defaults values back into the current params if not already set

        for (const key of Object.keys(Nperf2Runner.defaults)) {
            if (!this.params[key] || isEmpty(this.params[key])) {
                this.params[key] = Nperf2Runner.defaults[key];
            }
        }

        if (this.verbose) this.log("Updated params:" + this.getParamsLogTruncated(this.params));
    }

    setPeriod() {
        //reset from defaults
        this.periods = Array.isArray(Nperf2Runner.defaults.period) ? Nperf2Runner.defaults.period : [Nperf2Runner.defaults.period];

        var p = this.params.period;
        if (!p) return; //will use defaults

        this.periods = [];

        //string to ms e.g.: 1s->1000, 100ms->100
        var that = this;
        var setPeriodFromValue = function (val, isNum) {
            if (isNum) { //numbers are always ms
                that.periods.push(val);
                return;
            }
            var s = val;
            var l = s.length;
            //we expect the string to be at least two chars e.g. 1s
            //we know only two units : s and ms
            var m = s.substr(l - 2, 1);
            var isMs = isNum || m === "m";
            s = isMs ? s.substring(0, l - 2) : s.substring(0, l - 1);
            var n = parseInt(s);
            if (!isMs) n *= 1000;
            that.periods.push(n);
        };

        var a = Array.isArray(p) ? p : [p];

        a.forEach(function (val) {
            var isNum = !isNaN(val);
            setPeriodFromValue(val, isNum); //number will always be treated as ms
        });
    }

    checkParams(params) {

        if (params.help === true) {
            this.logUsage();
            return false;
        }

        this.setPeriod();

        var retVal = true;

        if (!params.targets) {
            if (this.verbose && !params.defaults) {
                var s = this.getParamsLogTruncated(params);
                this.log(`Info: No target specified on non default params:\n${s}`);
            }
            retVal = false;
        }
        if (params.dryrun === true) {
            this.log("");
            this.log("DRY RUN");
            this.log("");
            retVal = false;
        }
        return retVal;
    }

    getStats() {
        this.stats = {
            status: {},
            min: 99999999999,
            max: -1,
            avg: -1,
            count: 0,
            rate: 0,
            start: new Date()
        };
    }

    updateStats(stats, status) {
        // this.log(util.inspect(status));
        var respCode = status.status;
        var time = status.clientTime;
        stats.status[respCode] = stats.status[respCode] || 0;
        stats.status[respCode]++;
        if (time < stats.min) stats.min = time;
        if (time > stats.max) stats.max = time;
        stats.avg = (stats.avg * stats.count + time) / ++stats.count;
        stats.rate = stats.count / (new Date().getTime() - stats.start.getTime()) * 1000; // per sec
    }

    getHttp(target) {
        http.globalAgent.maxSockets = https.globalAgent.maxSockets = this.params.concurrency + 5;
        var httpGet = http.get;
        if (target.port == 443 || (target.protocol && target.protocol.indexOf('https') > -1) || (target.indexOf('https') > -1)) {
            httpGet = https.get;
        }
        return httpGet;
    }

    static get logUseColor() { return false; }

    logRequest(r, format) {

        format = Text;
        var output;
        if (format === 'json') {
            output = JSON.stringify(r);
        }
        else {

            // this.log(util.inspect(r));
            if (Nperf2Runner.logUseColor) {
                var statusColor = r.status == 200 ? "green" : "red";
                output = util.format("[%s] %s /%s time: %s (%s) %s",
                    r.status.toString()[statusColor],
                    r.responseCount,
                    r.requestId,
                    r.clientTime.toString().blue,
                    r.serverTime.toString().yellow),
                    r.target;
            } else {
                output = util.format("[%s] %s /%s time: %s (%s) %s",
                    r.status.toString(),
                    r.responseCount,
                    r.requestId,
                    r.clientTime.toString(),
                    r.serverTime.toString(),
                    r.target);
            }
        }
        this.log(output);
    }

    truncate(str, length, ending) {
        if (length == null) {
            length = 200;
        }
        if (ending == null) {
            ending = '...';
        }
        if (str.length > length) {
            return str.substring(0, length - ending.length) + ending;
        } else {
            return str;
        }
    };

    getParamsLogTruncated(params) {
        return this.truncate(util.inspect(params), 200).replace(/\n|{|}/gm, "");
    }

    doRequest(data, period, callback) {
        var that = this;
        var target = data.target;
        var http = this.getHttp(target);

        setTimeout(
            function () {
                var startTime = new Date().getTime();

                http(target, function (res) {

                    var body = "";

                    res.on('data', function (b) { body = b; });

                    res.on('end', function () {

                        var clientTime = new Date().getTime() - startTime;
                        var status = res.statusCode;

                        // show server-compute time if server reports it
                        function getServerTime(res) {
                            if (res.headers["x-response-time"]) return parseInt(res.headers["x-response-time"]);
                            if (res.headers["x-runtime"]) return Math.floor(res.headers["x-runtime"] * 1000);
                            return -1;
                        }
                        var serverTime = getServerTime(res);
                        var r = {
                            status: status,
                            requestId: data.requestId,
                            clientTime: clientTime,
                            serverTime: serverTime,
                            target: that.truncate(target, 300),
                            body: that.truncate(body.toString())
                        };
                        // that.logObject(r);

                        callback(r);
                    });
                }).on('error', function (err) {
                    var time = new Date().getTime() - startTime;
                    that.log("Error: " + err.message);
                    callback({ status: 0, error: err.message, clientTime: time, serverTime: -1, requestId: data.requestId, target: that.truncate(target) });
                })
            }, period);
    }

    completionCallback() {
        this.log("=== Requests Processing Completed ===");
    }

    getPeriod(periods) {
        if (1 === periods.length) { return periods[0]; }
        var r = Math.random();
        var min = periods[0];
        var max = periods[1];
        var p = max * r;
        return p < min ? min : p;
    }

    run(params) {
        var paramArray = Array.isArray(params) ? params : [params];
        let index = params.index.toString();
        for (var i = 0; i < paramArray.length; i++) {

            this.setParams(paramArray[i])

            // this.log("\n");
            // this.log(this.getParamsLogTruncated(paramArray[i]));
            // this.log(this.getParamsLogTruncated(this.params));
            // this.log("\n");

            if (paramArray.length > 1) index += `[${i}]`;

            var s = this.getParamsLogTruncated(this.params);
            if (!this.checkParams(this.params)) {
                if (this.verbose && this.params.defaults) this.log(`Defaults params (not executed) #${index}:\n${s}`);
                if (!this.params.defaults) this.log(`Non defaults params cannot be executed #${index}:\n${s}`);
                this.completionCallback();
                continue;
            }
            this.log(`Execution of param set #${index}:\n${s}`);
            this._run();
        }
    }

    //can be overriden to provide special processing of URL
    getTarget(target, extra) {
        return target;
    }

    round2(d) { return (Math.round(d * 100)) / 100; } //rounds to two decimals

    _run() {

        this.getStats();

        var maxRequests = this.params.requests;
        var requestPerRun = Math.ceil(maxRequests / this.params.concurrency);
        var root = this.params.root;

        var targets = Array.isArray(this.params.targets) ? this.params.targets : [this.params.targets];
        var nt = targets.length;
        var requests = [];
        var requestBunch = [];
        var l = 0;

        var that = this;

        for (var k = 0; k < nt; k++) {

            var j = 0;

            for (var i = 0; i < maxRequests; i++) {

                var target = this.getTarget(targets[k], this.params.extra);
                if (root) target = urljoin(root, target);

                var hasProtocol = target.toLowerCase().startsWith("http");
                if (!hasProtocol) target = "http://" + target;

                var r = {
                    target: target,
                    requestId: (1 + l++) //1 based index
                };

                requestBunch.push(r);
                if (++j == requestPerRun || (i + 1) == maxRequests) {
                    j = 0;
                    requests.push(requestBunch);
                    requestBunch = [];
                }
            }
        }

        async.forEachOf(requests, function (bunch, key, callback) {
            bunch.forEach(function (request) {
                var period = that.getPeriod(that.periods);

                // that.log(`period:${period}`);

                that.doRequest(request, period, function (status) {

                    if (0 === that.responseReceived) {
                        //Log a dummy request as header
                        that.logRequest({
                            status: "status",
                            responseCount: "Response #",
                            requestId: "Request Id",
                            clientTime: "Client Time (ms)",
                            serverTime: "Server Time (ms)",
                            target: "URL"
                        });
                    }

                    that.updateStats(that.stats, status);
                    that.responseReceived++;

                    status.responseCount = that.responseReceived;

                    //that.log(`#responseReceived: ${that.responseReceived} -> requests: ${l}\n`);

                    that.logRequest(status);

                    if (that.responseReceived === l) {
                        //all responses were received 
                        that.stats.total_time = new Date().getTime() - that.stats.start.getTime();
                        that.stats.avg = that.round2(that.stats.avg);
                        that.stats.rate = that.round2(that.stats.rate);
                        that.log(that.getParamsLogTruncated(that.stats));
                        that.completionCallback();
                    }
                });
            });
        }, function (err) {
            var msg = err ? err.message : "NULL";
            that.log("Error: " + msg);
        });
    }
}

class Nperf2 {

    constructor() {
        this.params = {};
        this.params[Defaults] = true; //set url params as defaults since they are always first processed
    }

    parseUrl(request) {
        var q = url.parse(request.url, true).query;
        var isTrue = function (p) {
            return (p.toLowerCase() === 'true');
        };
        //params can be defined from URL except targets as array, extra, root, which must be from conf file
        if (q[Targets]) this.params[Targets] = q[Targets];
        if (q[Conf]) this.params[Conf] = q[Conf];
        if (q[Concurrency]) this.params[Concurrency] = q[Concurrency];
        if (q[Requests]) this.params[Requests] = q[Requests];
        if (q[Period]) this.params[Period] = q[Period];
        this.params[Verbose] = q[Verbose] ? isTrue(q[Verbose]) : false;
        this.params[Dryrun] = q[Dryrun] ? isTrue(q[Dryrun]) : false;
        this.params[Help] = q[Help] ? isTrue(q[Help]) : false;

    }

    //use this function to modifiy the target before the request is executed
    getTargetCallback(target, extra) { return target; }

    run(request, response, completionCallback, logCallback) {
        //get params from URL if any
        this.parseUrl(request);
        //get params from config file if a conf file was passed in url
        Nperf2Runner.readConfigurationFiles(this.params, (params, err) => {

            //replace the default function to log to response as well as in console
            var log = (s) => {
                console.log(s);
                response.write(`#${s}\n`);
                if (logCallback) logCallback.call(this, s);
            }

            if (err) {
                if (err.code === 'ENOENT') {
                    let msg = `Error: Configuration file not found: ${f}`;
                    log(msg);
                }
                if (completionCallback) completionCallback();
            }

            var k = -1;

            var callback = function () {
                k++;
                if (k < (params.length - 1)) return;
                if (completionCallback) completionCallback();
            };

            for (var i = 0; i < params.length; i++) {

                if (params[i].conf) {
                    log(`Configuration file: ${params[i].conf}`);
                }

                var n = new Nperf2Runner(callback, log, this.getTargetCallback);
                params[i].index = i;
                n.run(params[i]);
            }
        });
    }
}


module.exports.Nperf2 = Nperf2;
