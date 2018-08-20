const http = require('http');
const url = require('url');
const HttpDispatcher = require('httpdispatcher');
var util = require('util');
var dispatcher     = new HttpDispatcher();

var { PerfTester } = require('./perfTester.js');

const hostname = '127.0.0.1';
const port = 8080;

function handleRequest(request, response){
  try {
      // log the request on console
      console.log(request.url);
      // Dispatch
      dispatcher.dispatch(request, response);
  } catch(err) {
      console.log(err);
  }
};

const server = http.createServer(handleRequest);

const ContentType = Object.freeze({
  Text:   'text/html',
  Plain:   'text/plain'
});

function writeHead(res,type, code){
  res.writeHead(code || 200, {'Content-Type': type});
};

dispatcher.onGet("/", function(req, res) {
  writeHead(res, ContentType.Text);

  console.clear();
  res.end('<h1>Server Load Test</h1>');
});

dispatcher.onGet("/nperf2", function(req, res) {

  writeHead(res, ContentType.Plain);

  var pt = new PerfTester();

  pt.run(req,res,function(){console.log('ALL DONE');res.end("ALL DONE");});
  
});


server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});