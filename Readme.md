# Nperf2 - Node HTTP Server Performance Tool

Nperf2 is a node server application for generic web server performance testing.
It sends http requests to a server or servers then measures, reports and logs the response time.
It can be used to simulate the stress on the server with multiple clients.

It is based on the nperf project, modified so that it can be used as a node js library instead of in command line.
Original source: https://github.com/zanchin/node-http-perf
The original code has been extensively refactored and modified.

The application must be installed on a server and its execution is triggered by an http request. It can be used from a browser which will display the results in return. 

## Sample Use

Run a test against www.xyz.foo using defaults parameters.

	localhost:8080/nperf2?targets=www.xyz.foo
	
Run a test using the parameters found in ./conf/conf.sample1.json

	localhost:8080/nperf2?conf=sample1
	
Sample Output:

    #[status] Response # /Request Id time: Client Time (ms) (Server Time (ms)) URL
    #[301] 1 /1 time: 24 (-1) http://www.xyz.foo
    #[301] 2 /2 time: 27 (-1) http://www.xyz.foo
    #[301] 3 /3 time: 29 (-1) http://www.xyz.foo
    #[301] 4 /4 time: 30 (-1) http://www.xyz.foo
    #[301] 5 /5 time: 32 (-1) http://www.xyz.foo
    #[301] 6 /6 time: 34 (-1) http://www.xyz.foo
    #[301] 7 /7 time: 36 (-1) http://www.xyz.foo
    # status:  '301': 7 ,  min: 24,  max: 36,  avg: 30.29,  count: 7,  rate: 50.72,  start: 2018-08-20T08:42:18.119Z,  total_time: 140 
    ALL DONE
	

## Install

Currently you need to download the source and install manually any dependency. We will release it as an NPM package in the future.
	
The installation contains the source and sample files. `_start.bat` can then be used to launch a local node server on Windows.

## Parameters

Most parameters can be set in the URL but to take full advantage of parameterization a config file is needed.
The parameters extra and root, targets and periods when defined as arrays, must be set in a config file.

### Help: Print this usage and exit

	localhost:8080/nperf2?help=true...
	
### Dryrun: Read config, but don't run

	localhost:8080/nperf2?dryrun=true,...

### Verbose: Verbose output

	localhost:8080/nperf2?verbose=true...

### Conf: Config file

	localhost:8080/nperf2?verbose=true&conf=sample1

The config file name can be set in full or be partial:

* Full file name - e.g.: `conf=./foo.json` will be converted to: `./conf/foo.json`

* Partial name (no .json extension) - e.g.: `conf=bar` will be converted to: `./conf/conf.bar.json`
	
### Defaults: Persist parameters as defaults settings

	A config file can list different series of tests but you may want to set some defaults only once e.g.:
	
	[
		{
			"root": "www.xyz.foo",
			"period": ["100ms","1s"],
			"requests": 3,
			"defaults": true  <-all above settings are now defaults and will be used in series below
		},
		{
			"targets": {"section/sports/baseball", "section/arts/design"},
			"period": ["10s"]  <- temporarily override defaults for this series only
		},
		{
			"targets": {"section/sports/golf", "section/arts/dance"},
			"requests": 5  <- temporarily override defaults for this series only
		}...

### Targets: TargetURL(s) 

	localhost:8080/nperf2?targets=www.xyz.foo
	
The url can only contain a single target, whereas the config file can contain a single target or an array:

	"targets": "http://www.xyz.foo"
	
	"targets": {"http://www.xyz.foo", "http://www.abc.foo"}
	
### Root: Defines a root URL to prefix the targets which must then be partial urls.

	Forward slashes are added b/w root and targets when needed.
	
	"root": "www.xyz.foo",
	"targets": {"section/sports/baseball", "section/arts/design"}
	
### Concurrency: Number of concurrent requests threads

Note that this parameter differs from the original nperf which sets the number of requests per thread.

### Requests: Max number of total requests

### Period: Time b/w each requests as ms or s, defaults to ms, it can be an array with the min and max period

Numeric values are assumed to be ms. Strings can be used with s and ms as units.
	
E.g.: 100, "100ms", "1s"
	
E.g.: ["100ms","1s"], [100,1000]
	
If the period is an array its value will be randomized b/w min and max for execution.

Arrays can only be defined in a config file.
	
### Extra: Custom parameters

Extra can only be defined in a config file. It defines a set of parameters that can be used for instance to dynamically modify the content of the URL.

Everytime nperf2 needs to make a request it will pass the url and the extra parameters to a getTarget function.

You will need to override the getTargetCallback function defined in the Nperf2 class to provide special processing of URL.

An example of this is found in the implementation of the PerfTester:

	var nperf2 = new Nperf2();
	nperf2.getTargetCallback = UrlProvider.getTarget;
	
Note that we do not pass a callback, we replace the existing function with our own.

Here is a sample custom implementation that appends a parameter named foo to the url with a value randomly selected in extra:
	
	getTarget(target, extra) {		
		var r = Math.random();
		var i = Math.floor(r*extra.length);	
		return target + "&foo=" + extra[i];			
	}
	
## Execution and Logging

Running the tests systematically produces a log in addition to the feedback on the screen and the console. A "log" folder is expected at the root level.

At this point running is sequential, res.end in server.js is called only when all the responses have been received which can take a bit of time. This is in order to log the status of the requests/responses in the browser window but is not ideal.

## License

This software is distributed under the MIT License.

## Disclaimer

To the best of our knowledge the URLs provided in this file and the sample config files are fake and provided only as samples. You should not test against those URLs and test only against valid URLs of your choosing. We decline any responsibility for the inappropriate or illegitimate use of this program.




		



