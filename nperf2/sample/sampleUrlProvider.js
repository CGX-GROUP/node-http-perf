/*
 * GPM Project (c) CGX 2018
 * Nperf2 for gpm performance testing
 * Pascal Guislain
*/

class UrlRegex {

    constructor(url) {
        this.url = url;
        this.Regex = /\.\.\./;
    }

    replacePage(page) {
        this.url = this.url.replace(this.Regex, page);
        return this.url;
    }

    static isParameterizedUrl(url) {
        return url.includes("...");;
    }
}

class UrlProvider {
    
    /**
     * url is a string: 'http://nyt.com';
     * we check if it contains a replaceable page (ellipsis):'http://blabla/.../blabla/'
	 * extra is an array of strings
	 * we replace the ellipsis by a randomly selected string from extra
     */

    static getTarget(target, extra){
        return new UrlProvider(target,extra).getUrl();
    }

    constructor(url,x) {
        this.url = url;
        this.x = x;
        this.urlIsParameterized = UrlRegex.isParameterizedUrl(url);     
		if(!x) return;		
		this.l = x.length;
    }	

    _getRandomPage(x) {
        var r = Math.random();
        var i = Math.floor(r*this.l);
        return this.x[i];
    }

    getUrl(){
        if(!this.urlIsParameterized) return this.url; //nothing else to do
        this._urlRegex = this._urlRegex || new UrlRegex(this.url);
        var r = this._urlRegex;
        var u = this.url;
        var p = this._getRandomPage();
        u = r.replacePage(p);
        return u;
    }

}



module.exports = {
    UrlProvider
}