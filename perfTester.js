/*
 * (c) CGX 2018
 * Nperf2 performance testing
 * Pascal Guislain
*/

var util = require('util');

var { Nperf2 } = require('./nperf2/nperf2.js');

var { UrlProvider } = require('./nperf2/sample/sampleUrlProvider.js');
var { PgIo } = require('./pgutils/io.js');
var { PgTime } = require('./pgutils/time.js');

class PerfTester{

    constructor(){
    }

    run(request, response, completionCallback){
        var nperf2 = new Nperf2();
        nperf2.getTargetCallback = UrlProvider.getTarget;

        var callback = function(){
            if(completionCallback) completionCallback();
        }

        var log = function(s){
            if(!this._sw){
                var ts = PgTime.getTimeStamp();
                var file = `./log/${ts}.log`;
                this._sw = new PgIo.StreamWriter(file);
            }
            
            this._sw.writeLogLine(s);
        };

        nperf2.run(request,response,callback,log);
    }

}

module.exports.PerfTester = PerfTesters;

