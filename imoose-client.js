let api = function ImooseClient( options = {} ) {

    let client = this;
    const request = require( 'request' );
    const crypto = require( 'crypto' );
    const file = require( 'fs' );
    const url = require( 'url' );
    const JSONbig = require( 'json-bigint' );
    const stringHash = require( 'string-hash' );
    let base = 'https://api.imoose.com';
    const userAgent = 'Mozilla/4.0 (compatible; Node Imoose API)';
    const contentType = 'application/x-www-form-urlencoded';
    const default_options = {
        recvWindow: 5000,    
        verbose: false,
        localAddress: false,
        family: false,
        log: function ( ...args ) {
            console.log( Array.prototype.slice.call( args ) );
        }
    };

    client.options = default_options;
    if ( options ) setOptions( options );

    function setOptions( opt = {}, callback = false ) {
        client.options = opt;
        if ( typeof client.options.recvWindow === 'undefined' ) client.options.recvWindow = default_options.recvWindow;
        if ( typeof client.options.log === 'undefined' ) client.options.log = default_options.log;
        if ( typeof client.options.verbose === 'undefined' ) client.options.verbose = default_options.verbose;
        if ( typeof client.options.localAddress === 'undefined' ) client.options.localAddress = default_options.localAddress;
        if ( typeof client.options.family === 'undefined' ) client.options.family = default_options.family;
        return this;
    }

    const reqHandler = cb => ( error, response, body ) => {
        if ( !cb ) return;
        if ( error ) return cb( error, {} );
        if ( response && response.statusCode !== 200 ) return cb( response, {} );
        return cb( null, JSONbig.parse( body ) );
    }


    const makeQueryString = q =>
        Object.keys( q )
            .reduce( ( a, k ) => {
                if ( Array.isArray( q[k] ) ) {
                    q[k].forEach( v => {
                        a.push( k + "=" + encodeURIComponent( v ) )
                    } )
                } else if ( q[k] !== undefined ) {
                    a.push( k + "=" + encodeURIComponent( q[k] ) );
                }
                return a;
            }, [] )
            .join( "&" );
        
    const reqObjQuery = ( url, data = {}, method = 'GET', key ) => ( {
        url: url,
        qs: data,
        method: method,
        family: client.options.family,
        localAddress: client.options.localAddress,
        timeout: client.options.recvWindow,
        headers: {
            'User-Agent': userAgent,
            'Content-type': contentType,
            'Api-Key': key || ''
        }
    } )

    const reqObjForm = ( url, data = {}, method = 'POST', key ) => ( {
        url: url,
        form: data,
        method: method,
        family: client.options.family,
        localAddress: client.options.localAddress,
        timeout: client.options.recvWindow,
        qsStringifyOptions: {
            arrayFormat: 'repeat'
        },
        headers: {
            'User-Agent': userAgent,
            'Content-type': contentType,
            'Api-Key': key || ''
        }
    } )


    const apiCall = (url,opts = {}, callback, method = 'GET' ) => {
        if ( !callback ) {
            return new Promise( ( resolve, reject ) => {
                callback = ( error, response ) => {
                    if ( error ) {
                        reject( error );
                    } else {
                        resolve( response );
                    }
                }
                apiRequest( base + url, opts, callback,method );
            } )
        } else {
            apiRequest( base + url, opts, callback,method );
        }
    }

    const apiRequest = ( url, data = {}, callback, method = 'GET' ) => {
        
        requireApiKey( 'apiRequest' );
        data.timestamp = new Date().getTime();
        data = Object.fromEntries(([...Object.entries(data)].sort()));

        let query = makeQueryString( data );

        let opt = {};
        if(method == 'GET' || method == 'DELETE'){
            opt = reqObjQuery(
                url + ( query ? '?' + query : '' ),
                data,
                method,
                client.options.APIKEY
            );
        } else {
            opt = reqObjForm(
                url,
                data,
                method,
                client.options.APIKEY
            );
        }
        if(url.includes('/private')){
            requireApiSecret('apiRequest')
            opt.headers['Api-Sign'] = crypto.createHmac( 'sha256', client.options.APISECRET ).update( query ).digest( 'hex' );
        }


        return request( opt, reqHandler( callback ) ).on('error', (err) => { callback( err, {} ) });
    };

    // Check if API key is empty or invalid
    const requireApiKey = function( source = 'requireApiKey', fatalError = true ) {
        if ( !client.options.APIKEY ) {
            if ( fatalError ) throw Error( `${ source }: Invalid API Key!` );
            return false;
        }
        return true;
    }

      // Check if API secret is present
      const requireApiSecret = function( source = 'requireApiSecret', fatalError = true ) {
        if ( !client.options.APIKEY ) {
            if ( fatalError ) throw Error( `${ source }: Invalid API Key!` );
            return false;
        }
        if ( !client.options.APISECRET ) {
            if ( fatalError ) throw Error( `${ source }: Invalid API Secret!` );
            return false;
        }
        return true;
    }

    return {
        getServerTime : function ( callback ) {
            apiCall('/v1/public/time',{},callback);
        },
        getServerStatus : function ( callback ) {
            apiCall('/v1/public/status', {}, callback);
        },
        getMarket : function(id, callback){
            apiCall('/v1/public/market', {id: id}, callback);
        },
        getMarkets : function(callback,type = 'spot'){
            apiCall('/v1/public/market',{type: type}, callback);
        },
        getAsset : function(id, callback) {
            apiCall('/v1/public/asset',{id: id},callback);
        },
        getAssets: function(callback){
            apiCall('/v1/public/asset',{subclass: assetclass},callback)
        },
        getTicker : function(id, callback){
            apiCall('/v1/public/ticker', {id: id}, callback);
        },
        getTickers : function(callback,type = 'spot'){
            apiCall('/v1/public/ticker',{type: type}, callback);
        },
        getMarketDepth : function(id, callback){
            apiCall('/v1/public/depth', {id: id}, callback);
        },
        getMarketTrades : function(id, callback){
            apiCall('/v1/public/trade', {id: id}, callback);
        },
        getPortfolios : function(callback){
            apiCall('/v1/private/portfolio', {}, callback);
        },
        getPortfolioBalance : function(id, callback){
            apiCall('/v1/private/balance', {id: id}, callback);
        },
        placeOrder : function(portfolio_id,side,type,market_id,volume,price,callback){
            apiCall('/v1/private/order',{portfolio_id: portfolio_id, side: side, type: type, market:market_id,volume: volume,price: price},callback,'POST');
        },
        placeLimitOrder : function(portfolio_id,side,market_id,volume,price,callback){
            apiCall('/v1/private/order',{portfolio_id: portfolio_id, side: side, type: 'limit', market:market_id,volume: volume,price: price},callback,'POST');
        },
        placeMarketOrder : function(portfolio_id,side,market_id,volume,callback){
            apiCall('/v1/private/order',{portfolio_id: portfolio_id, side: side, type: 'market', market:market_id,volume: volume},callback,'POST');
        },
        getOrder : function(id, callback){
            apiCall('/v1/private/order', {id: id}, callback);
        },
        cancelOrder : function(id, callback){
            apiCall('/v1/private/order', {id: id}, callback, 'DELETE');
        },
        getOpenOrders : function(portfolio_id, callback, limit = 0, from = ''){
            apiCall('/v1/private/order/open',{id: portfolio_id, limit: limit, from: from},callback);
        },
        getClosedOrders : function(portfolio_id, callback, limit = 0, from = ''){
            apiCall('/v1/private/order/closed',{id: portfolio_id, limit: limit, from: from},callback);
        }

    }
    
}
module.exports = api;