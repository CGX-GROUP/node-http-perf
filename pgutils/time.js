
class PgTime {

    static getTimeStamp(/*,localTime*/) { //TODO local time
        var ds = new Date().toISOString(); //"2016-06-03T23:15:33.008Z"
        ds = ds.replace(/[-T:Z.]/g, "").substr(0, 16);
        return ds;
    }

}

module.exports = { PgTime };