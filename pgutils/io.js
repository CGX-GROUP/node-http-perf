var fs = require('fs');
var path = require('path');

var { PgTime } = require('./time.js');

class PgIo{};

class FileReader {

    constructor(file) {
        this._path = path.resolve(file);
    }

    readSync() {
        var f = this._path;
        if (!fs.existsSync(f)) {
            throw new Error(`File not found: ${f}\n`);
        }
        var data = fs.readFileSync(f);
        return data;
    }

    readStringSync() { return this.readSync().toString(); }
}

PgIo.FileReader = FileReader;

class StreamWriter {

    //https://nodejs.org/api/fs.html#fs_fs_createwritestream_path_options
    //defaults to utf8 and autoclose
    constructor(file, options) {
        var f = path.resolve(file);
        this._stream = fs.createWriteStream(f, options);
    }

    write(data) {
        this._stream.write(data);
    }

    writeLine(data) {
        this._stream.write(`${data}\r\n`);
    }

    writeLogLine(data/*,localTime*/) { //TODO localTime to log in local time
        var ds = PgTime.getTimeStamp();
        this.writeLine(`${ds} ${data}`);
    }

    close() {
        this._stream.end();
    }
}

PgIo.StreamWriter = StreamWriter;

module.exports = { PgIo };


