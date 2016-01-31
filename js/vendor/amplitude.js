(function umd(require) {
    if ("object" == typeof exports) {
        module.exports = require("1")
    } else if ("function" == typeof define && define.amd) {
        define(function() {
            return require("1")
        })
    } else {
        this["amplitude"] = require("1")
    }
})(function outer(modules, cache, entries) {
    var global = function() {
        return this
    }();

    function require(name, jumped) {
        if (cache[name]) return cache[name].exports;
        if (modules[name]) return call(name, require);
        throw new Error('cannot find module "' + name + '"')
    }

    function call(id, require) {
        var m = cache[id] = {
            exports: {}
        };
        var mod = modules[id];
        var name = mod[2];
        var fn = mod[0];
        fn.call(m.exports, function(req) {
            var dep = modules[id][1][req];
            return require(dep ? dep : req)
        }, m, m.exports, outer, modules, cache, entries);
        if (name) cache[name] = cache[id];
        return cache[id].exports
    }
    for (var id in entries) {
        if (entries[id]) {
            global[entries[id]] = require(id)
        } else {
            require(id)
        }
    }
    require.duo = true;
    require.cache = cache;
    require.modules = modules;
    return require
}({
    1: [function(require, module, exports) {
        var Amplitude = require("./amplitude");
        var old = window.amplitude || {};
        var instance = new Amplitude;
        instance._q = old._q || [];
        module.exports = instance
    }, {
        "./amplitude": 2
    }],
    2: [function(require, module, exports) {
        var cookieStorage = require("./cookiestorage");
        var JSON = require("json");
        var language = require("./language");
        var localStorage = require("./localstorage");
        var md5 = require("JavaScript-MD5");
        var object = require("object");
        var Request = require("./xhr");
        var UAParser = require("ua-parser-js");
        var UUID = require("./uuid");
        var version = require("./version");
        var Identify = require("./identify");
        var type = require("./type");
        var log = function(s) {
            console.log("[Amplitude] " + s)
        };
        var IDENTIFY_EVENT = "$identify";
        var API_VERSION = 2;
        var MAX_STRING_LENGTH = 1024;
        var DEFAULT_OPTIONS = {
            apiEndpoint: "api.amplitude.com",
            cookieExpiration: 365 * 10,
            cookieName: "amplitude_id",
            domain: undefined,
            includeUtm: false,
            language: language.language,
            optOut: false,
            platform: "Web",
            savedMaxCount: 1e3,
            saveEvents: true,
            sessionTimeout: 30 * 60 * 1e3,
            unsentKey: "amplitude_unsent",
            unsentIdentifyKey: "amplitude_unsent_identify",
            uploadBatchSize: 100,
            batchEvents: false,
            eventUploadThreshold: 30,
            eventUploadPeriodMillis: 30 * 1e3
        };
        var LocalStorageKeys = {
            LAST_EVENT_ID: "amplitude_lastEventId",
            LAST_IDENTIFY_ID: "amplitude_lastIdentifyId",
            LAST_SEQUENCE_NUMBER: "amplitude_lastSequenceNumber",
            LAST_EVENT_TIME: "amplitude_lastEventTime",
            SESSION_ID: "amplitude_sessionId",
            REFERRER: "amplitude_referrer",
            DEVICE_ID: "amplitude_deviceId",
            USER_ID: "amplitude_userId",
            OPT_OUT: "amplitude_optOut"
        };
        var Amplitude = function() {
            this._unsentEvents = [];
            this._unsentIdentifys = [];
            this._ua = new UAParser(navigator.userAgent).getResult();
            this.options = object.merge({}, DEFAULT_OPTIONS);
            this.cookieStorage = (new cookieStorage).getStorage();
            this._q = []
        };
        Amplitude.prototype._eventId = 0;
        Amplitude.prototype._identifyId = 0;
        Amplitude.prototype._sequenceNumber = 0;
        Amplitude.prototype._sending = false;
        Amplitude.prototype._lastEventTime = null;
        Amplitude.prototype._sessionId = null;
        Amplitude.prototype._newSession = false;
        Amplitude.prototype._updateScheduled = false;
        Amplitude.prototype.Identify = Identify;
        Amplitude.prototype.init = function(apiKey, opt_userId, opt_config, callback) {
            try {
                this.options.apiKey = apiKey;
                if (opt_config) {
                    if (opt_config.saveEvents !== undefined) {
                        this.options.saveEvents = !!opt_config.saveEvents
                    }
                    if (opt_config.domain !== undefined) {
                        this.options.domain = opt_config.domain
                    }
                    if (opt_config.includeUtm !== undefined) {
                        this.options.includeUtm = !!opt_config.includeUtm
                    }
                    if (opt_config.includeReferrer !== undefined) {
                        this.options.includeReferrer = !!opt_config.includeReferrer
                    }
                    if (opt_config.batchEvents !== undefined) {
                        this.options.batchEvents = !!opt_config.batchEvents
                    }
                    this.options.platform = opt_config.platform || this.options.platform;
                    this.options.language = opt_config.language || this.options.language;
                    this.options.sessionTimeout = opt_config.sessionTimeout || this.options.sessionTimeout;
                    this.options.uploadBatchSize = opt_config.uploadBatchSize || this.options.uploadBatchSize;
                    this.options.eventUploadThreshold = opt_config.eventUploadThreshold || this.options.eventUploadThreshold;
                    this.options.savedMaxCount = opt_config.savedMaxCount || this.options.savedMaxCount;
                    this.options.eventUploadPeriodMillis = opt_config.eventUploadPeriodMillis || this.options.eventUploadPeriodMillis
                }
                this.cookieStorage.options({
                    expirationDays: this.options.cookieExpiration,
                    domain: this.options.domain
                });
                this.options.domain = this.cookieStorage.options().domain;
                _migrateLocalStorageDataToCookie(this);
                _loadCookieData(this);
                this.options.deviceId = opt_config && opt_config.deviceId !== undefined && opt_config.deviceId !== null && opt_config.deviceId || this.options.deviceId || UUID();
                this.options.userId = opt_userId !== undefined && opt_userId !== null && opt_userId || this.options.userId || null;
                this._lastEventTime = this._lastEventTime || parseInt(localStorage.getItem(LocalStorageKeys.LAST_EVENT_TIME)) || null;
                this._sessionId = this._sessionId || parseInt(localStorage.getItem(LocalStorageKeys.SESSION_ID)) || null;
                this._eventId = this._eventId || parseInt(localStorage.getItem(LocalStorageKeys.LAST_EVENT_ID)) || 0;
                this._identifyId = this._identifyId || parseInt(localStorage.getItem(LocalStorageKeys.LAST_IDENTIFY_ID)) || 0;
                this._sequenceNumber = this._sequenceNumber || parseInt(localStorage.getItem(LocalStorageKeys.LAST_SEQUENCE_NUMBER)) || 0;
                var now = (new Date).getTime();
                if (!this._sessionId || !this._lastEventTime || now - this._lastEventTime > this.options.sessionTimeout) {
                    this._newSession = true;
                    this._sessionId = now
                }
                this._lastEventTime = now;
                _saveCookieData(this);
                _clearSessionAndEventTrackingFromLocalStorage();
                if (this.options.saveEvents) {
                    this._loadSavedUnsentEvents(this.options.unsentKey, "_unsentEvents");
                    this._loadSavedUnsentEvents(this.options.unsentIdentifyKey, "_unsentIdentifys")
                }
                this._sendEventsIfReady();
                if (this.options.includeUtm) {
                    this._initUtmData()
                }
                if (this.options.includeReferrer) {
                    this._saveReferrer(this._getReferrer())
                }
            } catch (e) {
                log(e)
            }
            if (callback && type(callback) === "function") {
                callback()
            }
        };
        Amplitude.prototype.runQueuedFunctions = function() {
            for (var i = 0; i < this._q.length; i++) {
                var fn = this[this._q[i][0]];
                if (fn && type(fn) === "function") {
                    fn.apply(this, this._q[i].slice(1))
                }
            }
            this._q = []
        };
        Amplitude.prototype._loadSavedUnsentEvents = function(unsentKey, queue) {
            var savedUnsentEventsString = localStorage.getItem(unsentKey);
            if (savedUnsentEventsString) {
                try {
                    this[queue] = JSON.parse(savedUnsentEventsString)
                } catch (e) {}
            }
        };
        Amplitude.prototype.isNewSession = function() {
            return this._newSession
        };
        Amplitude.prototype.getSessionId = function() {
            return this._sessionId
        };
        Amplitude.prototype.nextEventId = function() {
            this._eventId++;
            return this._eventId
        };
        Amplitude.prototype.nextIdentifyId = function() {
            this._identifyId++;
            return this._identifyId
        };
        Amplitude.prototype.nextSequenceNumber = function() {
            this._sequenceNumber++;
            return this._sequenceNumber
        };
        Amplitude.prototype._unsentCount = function() {
            return this._unsentEvents.length + this._unsentIdentifys.length
        };
        Amplitude.prototype._sendEventsIfReady = function(callback) {
            if (this._unsentCount() === 0) {
                return false
            }
            if (!this.options.batchEvents) {
                this.sendEvents(callback);
                return true
            }
            if (this._unsentCount() >= this.options.eventUploadThreshold) {
                this.sendEvents(callback);
                return true
            }
            if (!this._updateScheduled) {
                this._updateScheduled = true;
                setTimeout(function() {
                    this._updateScheduled = false;
                    this.sendEvents()
                }.bind(this), this.options.eventUploadPeriodMillis)
            }
            return false
        };
        var _migrateLocalStorageDataToCookie = function(scope) {
            var cookieData = scope.cookieStorage.get(scope.options.cookieName);
            if (cookieData && cookieData.deviceId) {
                return
            }
            var cookieDeviceId = cookieData && cookieData.deviceId || null;
            var cookieUserId = cookieData && cookieData.userId || null;
            var cookieOptOut = cookieData && cookieData.optOut !== null && cookieData.optOut !== undefined ? cookieData.optOut : null;
            var keySuffix = "_" + scope.options.apiKey.slice(0, 6);
            var localStorageDeviceId = localStorage.getItem(LocalStorageKeys.DEVICE_ID + keySuffix);
            if (localStorageDeviceId) {
                localStorage.removeItem(LocalStorageKeys.DEVICE_ID + keySuffix)
            }
            var localStorageUserId = localStorage.getItem(LocalStorageKeys.USER_ID + keySuffix);
            if (localStorageUserId) {
                localStorage.removeItem(LocalStorageKeys.USER_ID + keySuffix)
            }
            var localStorageOptOut = localStorage.getItem(LocalStorageKeys.OPT_OUT + keySuffix);
            if (localStorageOptOut !== null && localStorageOptOut !== undefined) {
                localStorage.removeItem(LocalStorageKeys.OPT_OUT + keySuffix);
                localStorageOptOut = String(localStorageOptOut) === "true"
            }
            scope.cookieStorage.set(scope.options.cookieName, {
                deviceId: cookieDeviceId || localStorageDeviceId,
                userId: cookieUserId || localStorageUserId,
                optOut: cookieOptOut !== undefined && cookieOptOut !== null ? cookieOptOut : localStorageOptOut
            })
        };
        var _loadCookieData = function(scope) {
            var cookieData = scope.cookieStorage.get(scope.options.cookieName);
            if (cookieData) {
                if (cookieData.deviceId) {
                    scope.options.deviceId = cookieData.deviceId
                }
                if (cookieData.userId) {
                    scope.options.userId = cookieData.userId
                }
                if (cookieData.optOut !== null && cookieData.optOut !== undefined) {
                    scope.options.optOut = cookieData.optOut
                }
                if (cookieData.sessionId) {
                    scope._sessionId = parseInt(cookieData.sessionId)
                }
                if (cookieData.lastEventTime) {
                    scope._lastEventTime = parseInt(cookieData.lastEventTime)
                }
                if (cookieData.eventId) {
                    scope._eventId = parseInt(cookieData.eventId)
                }
                if (cookieData.identifyId) {
                    scope._identifyId = parseInt(cookieData.identifyId)
                }
                if (cookieData.sequenceNumber) {
                    scope._sequenceNumber = parseInt(cookieData.sequenceNumber)
                }
            }
        };
        var _saveCookieData = function(scope) {
            scope.cookieStorage.set(scope.options.cookieName, {
                deviceId: scope.options.deviceId,
                userId: scope.options.userId,
                optOut: scope.options.optOut,
                sessionId: scope._sessionId,
                lastEventTime: scope._lastEventTime,
                eventId: scope._eventId,
                identifyId: scope._identifyId,
                sequenceNumber: scope._sequenceNumber
            })
        };
        var _clearSessionAndEventTrackingFromLocalStorage = function() {
            localStorage.removeItem(LocalStorageKeys.SESSION_ID);
            localStorage.removeItem(LocalStorageKeys.LAST_EVENT_TIME);
            localStorage.removeItem(LocalStorageKeys.LAST_EVENT_ID);
            localStorage.removeItem(LocalStorageKeys.LAST_IDENTIFY_ID);
            localStorage.removeItem(LocalStorageKeys.LAST_SEQUENCE_NUMBER)
        };
        Amplitude._getUtmParam = function(name, query) {
            name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
            var regex = new RegExp("[\\?&]" + name + "=([^&#]*)");
            var results = regex.exec(query);
            return results === null ? undefined : decodeURIComponent(results[1].replace(/\+/g, " "))
        };
        Amplitude._getUtmData = function(rawCookie, query) {
            var cookie = rawCookie ? "?" + rawCookie.split(".").slice(-1)[0].replace(/\|/g, "&") : "";
            var fetchParam = function(queryName, query, cookieName, cookie) {
                return Amplitude._getUtmParam(queryName, query) || Amplitude._getUtmParam(cookieName, cookie)
            };
            return {
                utm_source: fetchParam("utm_source", query, "utmcsr", cookie),
                utm_medium: fetchParam("utm_medium", query, "utmcmd", cookie),
                utm_campaign: fetchParam("utm_campaign", query, "utmccn", cookie),
                utm_term: fetchParam("utm_term", query, "utmctr", cookie),
                utm_content: fetchParam("utm_content", query, "utmcct", cookie)
            }
        };
        Amplitude.prototype._initUtmData = function(queryParams, cookieParams) {
            queryParams = queryParams || location.search;
            cookieParams = cookieParams || this.cookieStorage.get("__utmz");
            this._utmProperties = Amplitude._getUtmData(cookieParams, queryParams)
        };
        Amplitude.prototype._getReferrer = function() {
            return document.referrer
        };
        Amplitude.prototype._getReferringDomain = function(referrer) {
            if (referrer === null || referrer === undefined || referrer === "") {
                return null
            }
            var parts = referrer.split("/");
            if (parts.length >= 3) {
                return parts[2]
            }
            return null
        };
        Amplitude.prototype._saveReferrer = function(referrer) {
            if (referrer === null || referrer === undefined || referrer === "") {
                return
            }
            var referring_domain = this._getReferringDomain(referrer);
            var identify = (new Identify).setOnce("initial_referrer", referrer);
            identify.setOnce("initial_referring_domain", referring_domain);
            var hasSessionStorage = window.sessionStorage ? true : false;
            if (hasSessionStorage && !window.sessionStorage.getItem(LocalStorageKeys.REFERRER) || !hasSessionStorage) {
                identify.set("referrer", referrer).set("referring_domain", referring_domain);
                if (hasSessionStorage) {
                    window.sessionStorage.setItem(LocalStorageKeys.REFERRER, referrer)
                }
            }
            this.identify(identify)
        };
        Amplitude.prototype.saveEvents = function() {
            try {
                localStorage.setItem(this.options.unsentKey, JSON.stringify(this._unsentEvents));
                localStorage.setItem(this.options.unsentIdentifyKey, JSON.stringify(this._unsentIdentifys))
            } catch (e) {}
        };
        Amplitude.prototype.setDomain = function(domain) {
            try {
                this.cookieStorage.options({
                    domain: domain
                });
                this.options.domain = this.cookieStorage.options().domain;
                _loadCookieData(this);
                _saveCookieData(this)
            } catch (e) {
                log(e)
            }
        };
        Amplitude.prototype.setUserId = function(userId) {
            try {
                this.options.userId = userId !== undefined && userId !== null && "" + userId || null;
                _saveCookieData(this)
            } catch (e) {
                log(e)
            }
        };
        Amplitude.prototype.setOptOut = function(enable) {
            try {
                this.options.optOut = enable;
                _saveCookieData(this)
            } catch (e) {
                log(e)
            }
        };
        Amplitude.prototype.setDeviceId = function(deviceId) {
            try {
                if (deviceId) {
                    this.options.deviceId = "" + deviceId;
                    _saveCookieData(this)
                }
            } catch (e) {
                log(e)
            }
        };
        Amplitude.prototype.setUserProperties = function(userProperties) {
            var identify = new Identify;
            for (var property in userProperties) {
                if (userProperties.hasOwnProperty(property)) {
                    identify.set(property, userProperties[property])
                }
            }
            this.identify(identify)
        };
        Amplitude.prototype.clearUserProperties = function() {
            var identify = new Identify;
            identify.clearAll();
            this.identify(identify)
        };
        Amplitude.prototype.identify = function(identify) {
            if (type(identify) === "object" && "_q" in identify) {
                var instance = new Identify;
                for (var i = 0; i < identify._q.length; i++) {
                    var fn = instance[identify._q[i][0]];
                    if (fn && type(fn) === "function") {
                        fn.apply(instance, identify._q[i].slice(1))
                    }
                }
                identify = instance
            }
            if (identify instanceof Identify && Object.keys(identify.userPropertiesOperations).length > 0) {
                this._logEvent(IDENTIFY_EVENT, null, null, identify.userPropertiesOperations)
            }
        };
        Amplitude.prototype.setVersionName = function(versionName) {
            try {
                this.options.versionName = versionName
            } catch (e) {
                log(e)
            }
        };
        Amplitude.prototype._truncate = function(value) {
            if (type(value) === "array") {
                for (var i = 0; i < value.length; i++) {
                    value[i] = this._truncate(value[i])
                }
            } else if (type(value) === "object") {
                for (var key in value) {
                    if (value.hasOwnProperty(key)) {
                        value[key] = this._truncate(value[key])
                    }
                }
            } else {
                value = _truncateValue(value)
            }
            return value
        };
        var _truncateValue = function(value) {
            if (type(value) === "string") {
                return value.length > MAX_STRING_LENGTH ? value.substring(0, MAX_STRING_LENGTH) : value
            }
            return value
        };
        Amplitude.prototype._logEvent = function(eventType, eventProperties, apiProperties, userProperties, callback) {
            if (type(callback) !== "function") {
                callback = null
            }
            if (!eventType || this.options.optOut) {
                if (callback) {
                    callback(0, "No request sent")
                }
                return
            }
            try {
                var eventId;
                if (eventType === IDENTIFY_EVENT) {
                    eventId = this.nextIdentifyId()
                } else {
                    eventId = this.nextEventId()
                }
                var sequenceNumber = this.nextSequenceNumber();
                var eventTime = (new Date).getTime();
                var ua = this._ua;
                if (!this._sessionId || !this._lastEventTime || eventTime - this._lastEventTime > this.options.sessionTimeout) {
                    this._sessionId = eventTime
                }
                this._lastEventTime = eventTime;
                _saveCookieData(this);
                userProperties = userProperties || {};
                if (eventType !== IDENTIFY_EVENT) {
                    object.merge(userProperties, this._utmProperties)
                }
                apiProperties = apiProperties || {};
                eventProperties = eventProperties || {};
                var event = {
                    device_id: this.options.deviceId,
                    user_id: this.options.userId || this.options.deviceId,
                    timestamp: eventTime,
                    event_id: eventId,
                    session_id: this._sessionId || -1,
                    event_type: eventType,
                    version_name: this.options.versionName || null,
                    platform: this.options.platform,
                    os_name: ua.browser.name || null,
                    os_version: ua.browser.major || null,
                    device_model: ua.os.name || null,
                    language: this.options.language,
                    api_properties: apiProperties,
                    event_properties: this._truncate(eventProperties),
                    user_properties: this._truncate(userProperties),
                    uuid: UUID(),
                    library: {
                        name: "amplitude-js",
                        version: this.__VERSION__
                    },
                    sequence_number: sequenceNumber
                };
                if (eventType === IDENTIFY_EVENT) {
                    this._unsentIdentifys.push(event);
                    this._limitEventsQueued(this._unsentIdentifys)
                } else {
                    this._unsentEvents.push(event);
                    this._limitEventsQueued(this._unsentEvents)
                }
                if (this.options.saveEvents) {
                    this.saveEvents()
                }
                if (!this._sendEventsIfReady(callback) && callback) {
                    callback(0, "No request sent")
                }
                return eventId
            } catch (e) {
                log(e)
            }
        };
        Amplitude.prototype._limitEventsQueued = function(queue) {
            if (queue.length > this.options.savedMaxCount) {
                queue.splice(0, queue.length - this.options.savedMaxCount)
            }
        };
        Amplitude.prototype.logEvent = function(eventType, eventProperties, callback) {
            return this._logEvent(eventType, eventProperties, null, null, callback)
        };
        var _isNumber = function(n) {
            return !isNaN(parseFloat(n)) && isFinite(n)
        };
        Amplitude.prototype.logRevenue = function(price, quantity, product) {
            if (!_isNumber(price) || quantity !== undefined && !_isNumber(quantity)) {
                return
            }
            return this._logEvent("revenue_amount", {}, {
                productId: product,
                special: "revenue_amount",
                quantity: quantity || 1,
                price: price
            })
        };
        Amplitude.prototype.removeEvents = function(maxEventId, maxIdentifyId) {
            if (maxEventId >= 0) {
                var filteredEvents = [];
                for (var i = 0; i < this._unsentEvents.length; i++) {
                    if (this._unsentEvents[i].event_id > maxEventId) {
                        filteredEvents.push(this._unsentEvents[i])
                    }
                }
                this._unsentEvents = filteredEvents
            }
            if (maxIdentifyId >= 0) {
                var filteredIdentifys = [];
                for (var j = 0; j < this._unsentIdentifys.length; j++) {
                    if (this._unsentIdentifys[j].event_id > maxIdentifyId) {
                        filteredIdentifys.push(this._unsentIdentifys[j])
                    }
                }
                this._unsentIdentifys = filteredIdentifys
            }
        };
        Amplitude.prototype.sendEvents = function(callback) {
            if (!this._sending && !this.options.optOut && this._unsentCount() > 0) {
                this._sending = true;
                var url = ("https:" === window.location.protocol ? "https" : "http") + "://" + this.options.apiEndpoint + "/";
                var numEvents = Math.min(this._unsentCount(), this.options.uploadBatchSize);
                var mergedEvents = this._mergeEventsAndIdentifys(numEvents);
                var maxEventId = mergedEvents.maxEventId;
                var maxIdentifyId = mergedEvents.maxIdentifyId;
                var events = JSON.stringify(mergedEvents.eventsToSend);
                var uploadTime = (new Date).getTime();
                var data = {
                    client: this.options.apiKey,
                    e: events,
                    v: API_VERSION,
                    upload_time: uploadTime,
                    checksum: md5(API_VERSION + this.options.apiKey + events + uploadTime)
                };
                var scope = this;
                new Request(url, data).send(function(status, response) {
                    scope._sending = false;
                    try {
                        if (status === 200 && response === "success") {
                            scope.removeEvents(maxEventId, maxIdentifyId);
                            if (scope.options.saveEvents) {
                                scope.saveEvents()
                            }
                            if (!scope._sendEventsIfReady(callback) && callback) {
                                callback(status, response)
                            }
                        } else if (status === 413) {
                            if (scope.options.uploadBatchSize === 1) {
                                scope.removeEvents(maxEventId, maxIdentifyId)
                            }
                            scope.options.uploadBatchSize = Math.ceil(numEvents / 2);
                            scope.sendEvents(callback)
                        } else if (callback) {
                            callback(status, response)
                        }
                    } catch (e) {}
                })
            } else if (callback) {
                callback(0, "No request sent")
            }
        };
        Amplitude.prototype._mergeEventsAndIdentifys = function(numEvents) {
            var eventsToSend = [];
            var eventIndex = 0;
            var maxEventId = -1;
            var identifyIndex = 0;
            var maxIdentifyId = -1;
            while (eventsToSend.length < numEvents) {
                var event;
                if (identifyIndex >= this._unsentIdentifys.length) {
                    event = this._unsentEvents[eventIndex++];
                    maxEventId = event.event_id
                } else if (eventIndex >= this._unsentEvents.length) {
                    event = this._unsentIdentifys[identifyIndex++];
                    maxIdentifyId = event.event_id
                } else {
                    if (!("sequence_number" in this._unsentEvents[eventIndex]) || this._unsentEvents[eventIndex].sequence_number < this._unsentIdentifys[identifyIndex].sequence_number) {
                        event = this._unsentEvents[eventIndex++];
                        maxEventId = event.event_id
                    } else {
                        event = this._unsentIdentifys[identifyIndex++];
                        maxIdentifyId = event.event_id
                    }
                }
                eventsToSend.push(event)
            }
            return {
                eventsToSend: eventsToSend,
                maxEventId: maxEventId,
                maxIdentifyId: maxIdentifyId
            }
        };
        Amplitude.prototype.setGlobalUserProperties = Amplitude.prototype.setUserProperties;
        Amplitude.prototype.__VERSION__ = version;
        module.exports = Amplitude
    }, {
        "./cookiestorage": 3,
        json: 4,
        "./language": 5,
        "./localstorage": 6,
        "JavaScript-MD5": 7,
        object: 8,
        "./xhr": 9,
        "ua-parser-js": 10,
        "./uuid": 11,
        "./version": 12,
        "./identify": 13,
        "./type": 14
    }],
    3: [function(require, module, exports) {
        var Cookie = require("./cookie");
        var JSON = require("json");
        var localStorage = require("./localstorage");
        var cookieStorage = function() {
            this.storage = null
        };
        cookieStorage.prototype._cookiesEnabled = function() {
            var uid = String(new Date);
            var result;
            try {
                Cookie.set(uid, uid);
                result = Cookie.get(uid) === uid;
                Cookie.remove(uid);
                return result
            } catch (e) {}
            return false
        };
        cookieStorage.prototype.getStorage = function() {
            if (this.storage !== null) {
                return this.storage
            }
            if (this._cookiesEnabled()) {
                this.storage = Cookie
            } else {
                var keyPrefix = "amp_cookiestore_";
                this.storage = {
                    _options: {
                        expirationDays: undefined,
                        domain: undefined
                    },
                    reset: function() {
                        this._options = {
                            expirationDays: undefined,
                            domain: undefined
                        }
                    },
                    options: function(opts) {
                        if (arguments.length === 0) {
                            return this._options
                        }
                        opts = opts || {};
                        this._options.expirationDays = opts.expirationDays || this._options.expirationDays;
                        this._options.domain = opts.domain || this._options.domain || window.location.hostname;
                        return this._options
                    },
                    get: function(name) {
                        try {
                            return JSON.parse(localStorage.getItem(keyPrefix + name))
                        } catch (e) {}
                        return null
                    },
                    set: function(name, value) {
                        try {
                            localStorage.setItem(keyPrefix + name, JSON.stringify(value));
                            return true
                        } catch (e) {}
                        return false
                    },
                    remove: function(name) {
                        try {
                            localStorage.removeItem(keyPrefix + name)
                        } catch (e) {
                            return false
                        }
                    }
                }
            }
            return this.storage
        };
        module.exports = cookieStorage
    }, {
        "./cookie": 15,
        json: 4,
        "./localstorage": 6
    }],
    15: [function(require, module, exports) {
        var Base64 = require("./base64");
        var JSON = require("json");
        var topDomain = require("top-domain");
        var _options = {
            expirationDays: undefined,
            domain: undefined
        };
        var reset = function() {
            _options = {
                expirationDays: undefined,
                domain: undefined
            }
        };
        var options = function(opts) {
            if (arguments.length === 0) {
                return _options
            }
            opts = opts || {};
            _options.expirationDays = opts.expirationDays;
            var domain = opts.domain !== undefined ? opts.domain : "." + topDomain(window.location.href);
            var token = Math.random();
            _options.domain = domain;
            set("amplitude_test", token);
            var stored = get("amplitude_test");
            if (!stored || stored !== token) {
                domain = null
            }
            remove("amplitude_test");
            _options.domain = domain
        };
        var _domainSpecific = function(name) {
            var suffix = "";
            if (_options.domain) {
                suffix = _options.domain.charAt(0) === "." ? _options.domain.substring(1) : _options.domain
            }
            return name + suffix
        };
        var get = function(name) {
            try {
                var nameEq = _domainSpecific(name) + "=";
                var ca = document.cookie.split(";");
                var value = null;
                for (var i = 0; i < ca.length; i++) {
                    var c = ca[i];
                    while (c.charAt(0) === " ") {
                        c = c.substring(1, c.length)
                    }
                    if (c.indexOf(nameEq) === 0) {
                        value = c.substring(nameEq.length, c.length);
                        break
                    }
                }
                if (value) {
                    return JSON.parse(Base64.decode(value))
                }
                return null
            } catch (e) {
                return null
            }
        };
        var set = function(name, value) {
            try {
                _set(_domainSpecific(name), Base64.encode(JSON.stringify(value)), _options);
                return true
            } catch (e) {
                return false
            }
        };
        var _set = function(name, value, opts) {
            var expires = value !== null ? opts.expirationDays : -1;
            if (expires) {
                var date = new Date;
                date.setTime(date.getTime() + expires * 24 * 60 * 60 * 1e3);
                expires = date
            }
            var str = name + "=" + value;
            if (expires) {
                str += "; expires=" + expires.toUTCString()
            }
            str += "; path=/";
            if (opts.domain) {
                str += "; domain=" + opts.domain
            }
            document.cookie = str
        };
        var remove = function(name) {
            try {
                _set(_domainSpecific(name), null, _options);
                return true
            } catch (e) {
                return false
            }
        };
        module.exports = {
            reset: reset,
            options: options,
            get: get,
            set: set,
            remove: remove
        }
    }, {
        "./base64": 16,
        json: 4,
        "top-domain": 17
    }],
    16: [function(require, module, exports) {
        var UTF8 = require("./utf8");
        var Base64 = {
            _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
            encode: function(input) {
                try {
                    if (window.btoa && window.atob) {
                        return window.btoa(unescape(encodeURIComponent(input)))
                    }
                } catch (e) {}
                return Base64._encode(input)
            },
            _encode: function(input) {
                var output = "";
                var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
                var i = 0;
                input = UTF8.encode(input);
                while (i < input.length) {
                    chr1 = input.charCodeAt(i++);
                    chr2 = input.charCodeAt(i++);
                    chr3 = input.charCodeAt(i++);
                    enc1 = chr1 >> 2;
                    enc2 = (chr1 & 3) << 4 | chr2 >> 4;
                    enc3 = (chr2 & 15) << 2 | chr3 >> 6;
                    enc4 = chr3 & 63;
                    if (isNaN(chr2)) {
                        enc3 = enc4 = 64
                    } else if (isNaN(chr3)) {
                        enc4 = 64
                    }
                    output = output + Base64._keyStr.charAt(enc1) + Base64._keyStr.charAt(enc2) + Base64._keyStr.charAt(enc3) + Base64._keyStr.charAt(enc4)
                }
                return output
            },
            decode: function(input) {
                try {
                    if (window.btoa && window.atob) {
                        return decodeURIComponent(escape(window.atob(input)))
                    }
                } catch (e) {}
                return Base64._decode(input)
            },
            _decode: function(input) {
                var output = "";
                var chr1, chr2, chr3;
                var enc1, enc2, enc3, enc4;
                var i = 0;
                input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
                while (i < input.length) {
                    enc1 = Base64._keyStr.indexOf(input.charAt(i++));
                    enc2 = Base64._keyStr.indexOf(input.charAt(i++));
                    enc3 = Base64._keyStr.indexOf(input.charAt(i++));
                    enc4 = Base64._keyStr.indexOf(input.charAt(i++));
                    chr1 = enc1 << 2 | enc2 >> 4;
                    chr2 = (enc2 & 15) << 4 | enc3 >> 2;
                    chr3 = (enc3 & 3) << 6 | enc4;
                    output = output + String.fromCharCode(chr1);
                    if (enc3 !== 64) {
                        output = output + String.fromCharCode(chr2)
                    }
                    if (enc4 !== 64) {
                        output = output + String.fromCharCode(chr3)
                    }
                }
                output = UTF8.decode(output);
                return output
            }
        };
        module.exports = Base64
    }, {
        "./utf8": 18
    }],
    18: [function(require, module, exports) {
        var UTF8 = {
            encode: function(s) {
                var utftext = "";
                for (var n = 0; n < s.length; n++) {
                    var c = s.charCodeAt(n);
                    if (c < 128) {
                        utftext += String.fromCharCode(c)
                    } else if (c > 127 && c < 2048) {
                        utftext += String.fromCharCode(c >> 6 | 192);
                        utftext += String.fromCharCode(c & 63 | 128)
                    } else {
                        utftext += String.fromCharCode(c >> 12 | 224);
                        utftext += String.fromCharCode(c >> 6 & 63 | 128);
                        utftext += String.fromCharCode(c & 63 | 128)
                    }
                }
                return utftext
            },
            decode: function(utftext) {
                var s = "";
                var i = 0;
                var c = 0,
                    c1 = 0,
                    c2 = 0;
                while (i < utftext.length) {
                    c = utftext.charCodeAt(i);
                    if (c < 128) {
                        s += String.fromCharCode(c);
                        i++
                    } else if (c > 191 && c < 224) {
                        c1 = utftext.charCodeAt(i + 1);
                        s += String.fromCharCode((c & 31) << 6 | c1 & 63);
                        i += 2
                    } else {
                        c1 = utftext.charCodeAt(i + 1);
                        c2 = utftext.charCodeAt(i + 2);
                        s += String.fromCharCode((c & 15) << 12 | (c1 & 63) << 6 | c2 & 63);
                        i += 3
                    }
                }
                return s
            }
        };
        module.exports = UTF8
    }, {}],
    4: [function(require, module, exports) {
        var json = window.JSON || {};
        var stringify = json.stringify;
        var parse = json.parse;
        module.exports = parse && stringify ? JSON : require("json-fallback")
    }, {
        "json-fallback": 19
    }],
    19: [function(require, module, exports) {
        (function() {
            "use strict";
            var JSON = module.exports = {};

            function f(n) {
                return n < 10 ? "0" + n : n
            }
            if (typeof Date.prototype.toJSON !== "function") {
                Date.prototype.toJSON = function() {
                    return isFinite(this.valueOf()) ? this.getUTCFullYear() + "-" + f(this.getUTCMonth() + 1) + "-" + f(this.getUTCDate()) + "T" + f(this.getUTCHours()) + ":" + f(this.getUTCMinutes()) + ":" + f(this.getUTCSeconds()) + "Z" : null
                };
                String.prototype.toJSON = Number.prototype.toJSON = Boolean.prototype.toJSON = function() {
                    return this.valueOf()
                }
            }
            var cx, escapable, gap, indent, meta, rep;

            function quote(string) {
                escapable.lastIndex = 0;
                return escapable.test(string) ? '"' + string.replace(escapable, function(a) {
                    var c = meta[a];
                    return typeof c === "string" ? c : "\\u" + ("0000" + a.charCodeAt(0).toString(16)).slice(-4)
                }) + '"' : '"' + string + '"'
            }

            function str(key, holder) {
                var i, k, v, length, mind = gap,
                    partial, value = holder[key];
                if (value && typeof value === "object" && typeof value.toJSON === "function") {
                    value = value.toJSON(key)
                }
                if (typeof rep === "function") {
                    value = rep.call(holder, key, value)
                }
                switch (typeof value) {
                    case "string":
                        return quote(value);
                    case "number":
                        return isFinite(value) ? String(value) : "null";
                    case "boolean":
                    case "null":
                        return String(value);
                    case "object":
                        if (!value) {
                            return "null"
                        }
                        gap += indent;
                        partial = [];
                        if (Object.prototype.toString.apply(value) === "[object Array]") {
                            length = value.length;
                            for (i = 0; i < length; i += 1) {
                                partial[i] = str(i, value) || "null"
                            }
                            v = partial.length === 0 ? "[]" : gap ? "[\n" + gap + partial.join(",\n" + gap) + "\n" + mind + "]" : "[" + partial.join(",") + "]";
                            gap = mind;
                            return v
                        }
                        if (rep && typeof rep === "object") {
                            length = rep.length;
                            for (i = 0; i < length; i += 1) {
                                if (typeof rep[i] === "string") {
                                    k = rep[i];
                                    v = str(k, value);
                                    if (v) {
                                        partial.push(quote(k) + (gap ? ": " : ":") + v)
                                    }
                                }
                            }
                        } else {
                            for (k in value) {
                                if (Object.prototype.hasOwnProperty.call(value, k)) {
                                    v = str(k, value);
                                    if (v) {
                                        partial.push(quote(k) + (gap ? ": " : ":") + v)
                                    }
                                }
                            }
                        }
                        v = partial.length === 0 ? "{}" : gap ? "{\n" + gap + partial.join(",\n" + gap) + "\n" + mind + "}" : "{" + partial.join(",") + "}";
                        gap = mind;
                        return v
                }
            }
            if (typeof JSON.stringify !== "function") {
                escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
                meta = {
                    "\b": "\\b",
                    "	": "\\t",
                    "\n": "\\n",
                    "\f": "\\f",
                    "\r": "\\r",
                    '"': '\\"',
                    "\\": "\\\\"
                };
                JSON.stringify = function(value, replacer, space) {
                    var i;
                    gap = "";
                    indent = "";
                    if (typeof space === "number") {
                        for (i = 0; i < space; i += 1) {
                            indent += " "
                        }
                    } else if (typeof space === "string") {
                        indent = space
                    }
                    rep = replacer;
                    if (replacer && typeof replacer !== "function" && (typeof replacer !== "object" || typeof replacer.length !== "number")) {
                        throw new Error("JSON.stringify")
                    }
                    return str("", {
                        "": value
                    })
                }
            }
            if (typeof JSON.parse !== "function") {
                cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
                JSON.parse = function(text, reviver) {
                    var j;

                    function walk(holder, key) {
                        var k, v, value = holder[key];
                        if (value && typeof value === "object") {
                            for (k in value) {
                                if (Object.prototype.hasOwnProperty.call(value, k)) {
                                    v = walk(value, k);
                                    if (v !== undefined) {
                                        value[k] = v
                                    } else {
                                        delete value[k]
                                    }
                                }
                            }
                        }
                        return reviver.call(holder, key, value)
                    }
                    text = String(text);
                    cx.lastIndex = 0;
                    if (cx.test(text)) {
                        text = text.replace(cx, function(a) {
                            return "\\u" + ("0000" + a.charCodeAt(0).toString(16)).slice(-4)
                        })
                    }
                    if (/^[\],:{}\s]*$/.test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, "@").replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, "]").replace(/(?:^|:|,)(?:\s*\[)+/g, ""))) {
                        j = eval("(" + text + ")");
                        return typeof reviver === "function" ? walk({
                            "": j
                        }, "") : j
                    }
                    throw new SyntaxError("JSON.parse")
                }
            }
        })()
    }, {}],
    17: [function(require, module, exports) {
        var parse = require("url").parse;
        module.exports = domain;
        var regexp = /[a-z0-9][a-z0-9\-]*[a-z0-9]\.[a-z\.]{2,6}$/i;

        function domain(url) {
            var host = parse(url).hostname;
            var match = host.match(regexp);
            return match ? match[0] : ""
        }
    }, {
        url: 20
    }],
    20: [function(require, module, exports) {
        exports.parse = function(url) {
            var a = document.createElement("a");
            a.href = url;
            return {
                href: a.href,
                host: a.host || location.host,
                port: "0" === a.port || "" === a.port ? port(a.protocol) : a.port,
                hash: a.hash,
                hostname: a.hostname || location.hostname,
                pathname: a.pathname.charAt(0) != "/" ? "/" + a.pathname : a.pathname,
                protocol: !a.protocol || ":" == a.protocol ? location.protocol : a.protocol,
                search: a.search,
                query: a.search.slice(1)
            }
        };
        exports.isAbsolute = function(url) {
            return 0 == url.indexOf("//") || !!~url.indexOf("://")
        };
        exports.isRelative = function(url) {
            return !exports.isAbsolute(url)
        };
        exports.isCrossDomain = function(url) {
            url = exports.parse(url);
            var location = exports.parse(window.location.href);
            return url.hostname !== location.hostname || url.port !== location.port || url.protocol !== location.protocol
        };

        function port(protocol) {
            switch (protocol) {
                case "http:":
                    return 80;
                case "https:":
                    return 443;
                default:
                    return location.port
            }
        }
    }, {}],
    6: [function(require, module, exports) {
        var localStorage;

        function windowLocalStorageAvailable() {
            var uid = new Date;
            var result;
            try {
                window.localStorage.setItem(uid, uid);
                result = window.localStorage.getItem(uid) === String(uid);
                window.localStorage.removeItem(uid);
                return result
            } catch (e) {}
            return false
        }
        if (windowLocalStorageAvailable()) {
            localStorage = window.localStorage
        } else if (window.globalStorage) {
            try {
                localStorage = window.globalStorage[window.location.hostname]
            } catch (e) {}
        } else {
            var div = document.createElement("div"),
                attrKey = "localStorage";
            div.style.display = "none";
            document.getElementsByTagName("head")[0].appendChild(div);
            if (div.addBehavior) {
                div.addBehavior("#default#userdata");
                localStorage = {
                    length: 0,
                    setItem: function(k, v) {
                        div.load(attrKey);
                        if (!div.getAttribute(k)) {
                            this.length++
                        }
                        div.setAttribute(k, v);
                        div.save(attrKey)
                    },
                    getItem: function(k) {
                        div.load(attrKey);
                        return div.getAttribute(k)
                    },
                    removeItem: function(k) {
                        div.load(attrKey);
                        if (div.getAttribute(k)) {
                            this.length--
                        }
                        div.removeAttribute(k);
                        div.save(attrKey)
                    },
                    clear: function() {
                        div.load(attrKey);
                        var i = 0;
                        var attr;
                        while (attr = div.XMLDocument.documentElement.attributes[i++]) {
                            div.removeAttribute(attr.name)
                        }
                        div.save(attrKey);
                        this.length = 0
                    },
                    key: function(k) {
                        div.load(attrKey);
                        return div.XMLDocument.documentElement.attributes[k]
                    }
                };
                div.load(attrKey);
                localStorage.length = div.XMLDocument.documentElement.attributes.length
            } else {}
        }
        if (!localStorage) {
            localStorage = {
                length: 0,
                setItem: function(k, v) {},
                getItem: function(k) {},
                removeItem: function(k) {},
                clear: function() {},
                key: function(k) {}
            }
        }
        module.exports = localStorage
    }, {}],
    5: [function(require, module, exports) {
        var getLanguage = function() {
            return navigator && (navigator.languages && navigator.languages[0] || navigator.language || navigator.userLanguage) || undefined
        };
        module.exports = {
            language: getLanguage()
        }
    }, {}],
    7: [function(require, module, exports) {
        (function($) {
            "use strict";

            function safe_add(x, y) {
                var lsw = (x & 65535) + (y & 65535),
                    msw = (x >> 16) + (y >> 16) + (lsw >> 16);
                return msw << 16 | lsw & 65535
            }

            function bit_rol(num, cnt) {
                return num << cnt | num >>> 32 - cnt
            }

            function md5_cmn(q, a, b, x, s, t) {
                return safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s), b);
            }

            function md5_ff(a, b, c, d, x, s, t) {
                return md5_cmn(b & c | ~b & d, a, b, x, s, t)
            }

            function md5_gg(a, b, c, d, x, s, t) {
                return md5_cmn(b & d | c & ~d, a, b, x, s, t)
            }

            function md5_hh(a, b, c, d, x, s, t) {
                return md5_cmn(b ^ c ^ d, a, b, x, s, t)
            }

            function md5_ii(a, b, c, d, x, s, t) {
                return md5_cmn(c ^ (b | ~d), a, b, x, s, t)
            }

            function binl_md5(x, len) {
                x[len >> 5] |= 128 << len % 32;
                x[(len + 64 >>> 9 << 4) + 14] = len;
                var i, olda, oldb, oldc, oldd, a = 1732584193,
                    b = -271733879,
                    c = -1732584194,
                    d = 271733878;
                for (i = 0; i < x.length; i += 16) {
                    olda = a;
                    oldb = b;
                    oldc = c;
                    oldd = d;
                    a = md5_ff(a, b, c, d, x[i], 7, -680876936);
                    d = md5_ff(d, a, b, c, x[i + 1], 12, -389564586);
                    c = md5_ff(c, d, a, b, x[i + 2], 17, 606105819);
                    b = md5_ff(b, c, d, a, x[i + 3], 22, -1044525330);
                    a = md5_ff(a, b, c, d, x[i + 4], 7, -176418897);
                    d = md5_ff(d, a, b, c, x[i + 5], 12, 1200080426);
                    c = md5_ff(c, d, a, b, x[i + 6], 17, -1473231341);
                    b = md5_ff(b, c, d, a, x[i + 7], 22, -45705983);
                    a = md5_ff(a, b, c, d, x[i + 8], 7, 1770035416);
                    d = md5_ff(d, a, b, c, x[i + 9], 12, -1958414417);
                    c = md5_ff(c, d, a, b, x[i + 10], 17, -42063);
                    b = md5_ff(b, c, d, a, x[i + 11], 22, -1990404162);
                    a = md5_ff(a, b, c, d, x[i + 12], 7, 1804603682);
                    d = md5_ff(d, a, b, c, x[i + 13], 12, -40341101);
                    c = md5_ff(c, d, a, b, x[i + 14], 17, -1502002290);
                    b = md5_ff(b, c, d, a, x[i + 15], 22, 1236535329);
                    a = md5_gg(a, b, c, d, x[i + 1], 5, -165796510);
                    d = md5_gg(d, a, b, c, x[i + 6], 9, -1069501632);
                    c = md5_gg(c, d, a, b, x[i + 11], 14, 643717713);
                    b = md5_gg(b, c, d, a, x[i], 20, -373897302);
                    a = md5_gg(a, b, c, d, x[i + 5], 5, -701558691);
                    d = md5_gg(d, a, b, c, x[i + 10], 9, 38016083);
                    c = md5_gg(c, d, a, b, x[i + 15], 14, -660478335);
                    b = md5_gg(b, c, d, a, x[i + 4], 20, -405537848);
                    a = md5_gg(a, b, c, d, x[i + 9], 5, 568446438);
                    d = md5_gg(d, a, b, c, x[i + 14], 9, -1019803690);
                    c = md5_gg(c, d, a, b, x[i + 3], 14, -187363961);
                    b = md5_gg(b, c, d, a, x[i + 8], 20, 1163531501);
                    a = md5_gg(a, b, c, d, x[i + 13], 5, -1444681467);
                    d = md5_gg(d, a, b, c, x[i + 2], 9, -51403784);
                    c = md5_gg(c, d, a, b, x[i + 7], 14, 1735328473);
                    b = md5_gg(b, c, d, a, x[i + 12], 20, -1926607734);
                    a = md5_hh(a, b, c, d, x[i + 5], 4, -378558);
                    d = md5_hh(d, a, b, c, x[i + 8], 11, -2022574463);
                    c = md5_hh(c, d, a, b, x[i + 11], 16, 1839030562);
                    b = md5_hh(b, c, d, a, x[i + 14], 23, -35309556);
                    a = md5_hh(a, b, c, d, x[i + 1], 4, -1530992060);
                    d = md5_hh(d, a, b, c, x[i + 4], 11, 1272893353);
                    c = md5_hh(c, d, a, b, x[i + 7], 16, -155497632);
                    b = md5_hh(b, c, d, a, x[i + 10], 23, -1094730640);
                    a = md5_hh(a, b, c, d, x[i + 13], 4, 681279174);
                    d = md5_hh(d, a, b, c, x[i], 11, -358537222);
                    c = md5_hh(c, d, a, b, x[i + 3], 16, -722521979);
                    b = md5_hh(b, c, d, a, x[i + 6], 23, 76029189);
                    a = md5_hh(a, b, c, d, x[i + 9], 4, -640364487);
                    d = md5_hh(d, a, b, c, x[i + 12], 11, -421815835);
                    c = md5_hh(c, d, a, b, x[i + 15], 16, 530742520);
                    b = md5_hh(b, c, d, a, x[i + 2], 23, -995338651);
                    a = md5_ii(a, b, c, d, x[i], 6, -198630844);
                    d = md5_ii(d, a, b, c, x[i + 7], 10, 1126891415);
                    c = md5_ii(c, d, a, b, x[i + 14], 15, -1416354905);
                    b = md5_ii(b, c, d, a, x[i + 5], 21, -57434055);
                    a = md5_ii(a, b, c, d, x[i + 12], 6, 1700485571);
                    d = md5_ii(d, a, b, c, x[i + 3], 10, -1894986606);
                    c = md5_ii(c, d, a, b, x[i + 10], 15, -1051523);
                    b = md5_ii(b, c, d, a, x[i + 1], 21, -2054922799);
                    a = md5_ii(a, b, c, d, x[i + 8], 6, 1873313359);
                    d = md5_ii(d, a, b, c, x[i + 15], 10, -30611744);
                    c = md5_ii(c, d, a, b, x[i + 6], 15, -1560198380);
                    b = md5_ii(b, c, d, a, x[i + 13], 21, 1309151649);
                    a = md5_ii(a, b, c, d, x[i + 4], 6, -145523070);
                    d = md5_ii(d, a, b, c, x[i + 11], 10, -1120210379);
                    c = md5_ii(c, d, a, b, x[i + 2], 15, 718787259);
                    b = md5_ii(b, c, d, a, x[i + 9], 21, -343485551);
                    a = safe_add(a, olda);
                    b = safe_add(b, oldb);
                    c = safe_add(c, oldc);
                    d = safe_add(d, oldd)
                }
                return [a, b, c, d]
            }

            function binl2rstr(input) {
                var i, output = "";
                for (i = 0; i < input.length * 32; i += 8) {
                    output += String.fromCharCode(input[i >> 5] >>> i % 32 & 255)
                }
                return output
            }

            function rstr2binl(input) {
                var i, output = [];
                output[(input.length >> 2) - 1] = undefined;
                for (i = 0; i < output.length; i += 1) {
                    output[i] = 0
                }
                for (i = 0; i < input.length * 8; i += 8) {
                    output[i >> 5] |= (input.charCodeAt(i / 8) & 255) << i % 32
                }
                return output
            }

            function rstr_md5(s) {
                return binl2rstr(binl_md5(rstr2binl(s), s.length * 8))
            }

            function rstr_hmac_md5(key, data) {
                var i, bkey = rstr2binl(key),
                    ipad = [],
                    opad = [],
                    hash;
                ipad[15] = opad[15] = undefined;
                if (bkey.length > 16) {
                    bkey = binl_md5(bkey, key.length * 8)
                }
                for (i = 0; i < 16; i += 1) {
                    ipad[i] = bkey[i] ^ 909522486;
                    opad[i] = bkey[i] ^ 1549556828
                }
                hash = binl_md5(ipad.concat(rstr2binl(data)), 512 + data.length * 8);
                return binl2rstr(binl_md5(opad.concat(hash), 512 + 128))
            }

            function rstr2hex(input) {
                var hex_tab = "0123456789abcdef",
                    output = "",
                    x, i;
                for (i = 0; i < input.length; i += 1) {
                    x = input.charCodeAt(i);
                    output += hex_tab.charAt(x >>> 4 & 15) + hex_tab.charAt(x & 15)
                }
                return output
            }

            function str2rstr_utf8(input) {
                return unescape(encodeURIComponent(input))
            }

            function raw_md5(s) {
                return rstr_md5(str2rstr_utf8(s))
            }

            function hex_md5(s) {
                return rstr2hex(raw_md5(s))
            }

            function raw_hmac_md5(k, d) {
                return rstr_hmac_md5(str2rstr_utf8(k), str2rstr_utf8(d))
            }

            function hex_hmac_md5(k, d) {
                return rstr2hex(raw_hmac_md5(k, d))
            }

            function md5(string, key, raw) {
                if (!key) {
                    if (!raw) {
                        return hex_md5(string)
                    }
                    return raw_md5(string)
                }
                if (!raw) {
                    return hex_hmac_md5(key, string)
                }
                return raw_hmac_md5(key, string)
            }
            if (typeof exports !== "undefined") {
                if (typeof module !== "undefined" && module.exports) {
                    exports = module.exports = md5
                }
                exports.md5 = md5
            } else {
                if (typeof define === "function" && define.amd) {
                    define(function() {
                        return md5
                    })
                } else {
                    $.md5 = md5
                }
            }
        })(this)
    }, {}],
    8: [function(require, module, exports) {
        var has = Object.prototype.hasOwnProperty;
        exports.keys = Object.keys || function(obj) {
            var keys = [];
            for (var key in obj) {
                if (has.call(obj, key)) {
                    keys.push(key)
                }
            }
            return keys
        };
        exports.values = function(obj) {
            var vals = [];
            for (var key in obj) {
                if (has.call(obj, key)) {
                    vals.push(obj[key])
                }
            }
            return vals
        };
        exports.merge = function(a, b) {
            for (var key in b) {
                if (has.call(b, key)) {
                    a[key] = b[key]
                }
            }
            return a
        };
        exports.length = function(obj) {
            return exports.keys(obj).length
        };
        exports.isEmpty = function(obj) {
            return 0 == exports.length(obj)
        }
    }, {}],
    9: [function(require, module, exports) {
        var querystring = require("querystring");
        var Request = function(url, data) {
            this.url = url;
            this.data = data || {}
        };
        Request.prototype.send = function(callback) {
            var isIE = window.XDomainRequest ? true : false;
            if (isIE) {
                var xdr = new window.XDomainRequest;
                xdr.open("POST", this.url, true);
                xdr.onload = function() {
                    callback(200, xdr.responseText)
                };
                xdr.onerror = function() {
                    if (xdr.responseText === "Request Entity Too Large") {
                        callback(413, xdr.responseText)
                    } else {
                        callback(500, xdr.responseText)
                    }
                };
                xdr.ontimeout = function() {};
                xdr.onprogress = function() {};
                xdr.send(querystring.stringify(this.data))
            } else {
                var xhr = new XMLHttpRequest;
                xhr.open("POST", this.url, true);
                xhr.onreadystatechange = function() {
                    if (xhr.readyState === 4) {
                        callback(xhr.status, xhr.responseText)
                    }
                };
                xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
                xhr.send(querystring.stringify(this.data))
            }
        };
        module.exports = Request
    }, {
        querystring: 21
    }],
    21: [function(require, module, exports) {
        var encode = encodeURIComponent;
        var decode = decodeURIComponent;
        var trim = require("trim");
        var type = require("type");
        exports.parse = function(str) {
            if ("string" != typeof str) return {};
            str = trim(str);
            if ("" == str) return {};
            if ("?" == str.charAt(0)) str = str.slice(1);
            var obj = {};
            var pairs = str.split("&");
            for (var i = 0; i < pairs.length; i++) {
                var parts = pairs[i].split("=");
                var key = decode(parts[0]);
                var m;
                if (m = /(\w+)\[(\d+)\]/.exec(key)) {
                    obj[m[1]] = obj[m[1]] || [];
                    obj[m[1]][m[2]] = decode(parts[1]);
                    continue
                }
                obj[parts[0]] = null == parts[1] ? "" : decode(parts[1])
            }
            return obj
        };
        exports.stringify = function(obj) {
            if (!obj) return "";
            var pairs = [];
            for (var key in obj) {
                var value = obj[key];
                if ("array" == type(value)) {
                    for (var i = 0; i < value.length; ++i) {
                        pairs.push(encode(key + "[" + i + "]") + "=" + encode(value[i]))
                    }
                    continue
                }
                pairs.push(encode(key) + "=" + encode(obj[key]))
            }
            return pairs.join("&")
        }
    }, {
        trim: 22,
        type: 23
    }],
    22: [function(require, module, exports) {
        exports = module.exports = trim;

        function trim(str) {
            if (str.trim) return str.trim();
            return str.replace(/^\s*|\s*$/g, "")
        }
        exports.left = function(str) {
            if (str.trimLeft) return str.trimLeft();
            return str.replace(/^\s*/, "")
        };
        exports.right = function(str) {
            if (str.trimRight) return str.trimRight();
            return str.replace(/\s*$/, "")
        }
    }, {}],
    23: [function(require, module, exports) {
        var toString = Object.prototype.toString;
        module.exports = function(val) {
            switch (toString.call(val)) {
                case "[object Date]":
                    return "date";
                case "[object RegExp]":
                    return "regexp";
                case "[object Arguments]":
                    return "arguments";
                case "[object Array]":
                    return "array";
                case "[object Error]":
                    return "error"
            }
            if (val === null) return "null";
            if (val === undefined) return "undefined";
            if (val !== val) return "nan";
            if (val && val.nodeType === 1) return "element";
            if (isBuffer(val)) return "buffer";
            val = val.valueOf ? val.valueOf() : Object.prototype.valueOf.apply(val);
            return typeof val
        };

        function isBuffer(obj) {
            return !!(obj != null && (obj._isBuffer || obj.constructor && typeof obj.constructor.isBuffer === "function" && obj.constructor.isBuffer(obj)))
        }
    }, {}],
    10: [function(require, module, exports) {
        (function(window, undefined) {
            "use strict";
            var LIBVERSION = "0.7.7",
                EMPTY = "",
                UNKNOWN = "?",
                FUNC_TYPE = "function",
                UNDEF_TYPE = "undefined",
                OBJ_TYPE = "object",
                STR_TYPE = "string",
                MAJOR = "major",
                MODEL = "model",
                NAME = "name",
                TYPE = "type",
                VENDOR = "vendor",
                VERSION = "version",
                ARCHITECTURE = "architecture",
                CONSOLE = "console",
                MOBILE = "mobile",
                TABLET = "tablet",
                SMARTTV = "smarttv",
                WEARABLE = "wearable",
                EMBEDDED = "embedded";
            var util = {
                extend: function(regexes, extensions) {
                    for (var i in extensions) {
                        if ("browser cpu device engine os".indexOf(i) !== -1 && extensions[i].length % 2 === 0) {
                            regexes[i] = extensions[i].concat(regexes[i])
                        }
                    }
                    return regexes
                },
                has: function(str1, str2) {
                    if (typeof str1 === "string") {
                        return str2.toLowerCase().indexOf(str1.toLowerCase()) !== -1
                    } else {
                        return false
                    }
                },
                lowerize: function(str) {
                    return str.toLowerCase()
                },
                major: function(version) {
                    return typeof version === STR_TYPE ? version.split(".")[0] : undefined
                }
            };
            var mapper = {
                rgx: function() {
                    var result, i = 0,
                        j, k, p, q, matches, match, args = arguments;
                    while (i < args.length && !matches) {
                        var regex = args[i],
                            props = args[i + 1];
                        if (typeof result === UNDEF_TYPE) {
                            result = {};
                            for (p in props) {
                                q = props[p];
                                if (typeof q === OBJ_TYPE) {
                                    result[q[0]] = undefined
                                } else {
                                    result[q] = undefined
                                }
                            }
                        }
                        j = k = 0;
                        while (j < regex.length && !matches) {
                            matches = regex[j++].exec(this.getUA());
                            if (!!matches) {
                                for (p = 0; p < props.length; p++) {
                                    match = matches[++k];
                                    q = props[p];
                                    if (typeof q === OBJ_TYPE && q.length > 0) {
                                        if (q.length == 2) {
                                            if (typeof q[1] == FUNC_TYPE) {
                                                result[q[0]] = q[1].call(this, match)
                                            } else {
                                                result[q[0]] = q[1]
                                            }
                                        } else if (q.length == 3) {
                                            if (typeof q[1] === FUNC_TYPE && !(q[1].exec && q[1].test)) {
                                                result[q[0]] = match ? q[1].call(this, match, q[2]) : undefined
                                            } else {
                                                result[q[0]] = match ? match.replace(q[1], q[2]) : undefined
                                            }
                                        } else if (q.length == 4) {
                                            result[q[0]] = match ? q[3].call(this, match.replace(q[1], q[2])) : undefined
                                        }
                                    } else {
                                        result[q] = match ? match : undefined
                                    }
                                }
                            }
                        }
                        i += 2
                    }
                    return result
                },
                str: function(str, map) {
                    for (var i in map) {
                        if (typeof map[i] === OBJ_TYPE && map[i].length > 0) {
                            for (var j = 0; j < map[i].length; j++) {
                                if (util.has(map[i][j], str)) {
                                    return i === UNKNOWN ? undefined : i
                                }
                            }
                        } else if (util.has(map[i], str)) {
                            return i === UNKNOWN ? undefined : i
                        }
                    }
                    return str
                }
            };
            var maps = {
                browser: {
                    oldsafari: {
                        version: {
                            "1.0": "/8",
                            1.2: "/1",
                            1.3: "/3",
                            "2.0": "/412",
                            "2.0.2": "/416",
                            "2.0.3": "/417",
                            "2.0.4": "/419",
                            "?": "/"
                        }
                    },
                    name: {
                        "Opera Mobile": "Opera Mobi",
                        "IE Mobile": "IEMobile"
                    }
                },
                device: {
                    amazon: {
                        model: {
                            "Fire Phone": ["SD", "KF"]
                        }
                    },
                    sprint: {
                        model: {
                            "Evo Shift 4G": "7373KT"
                        },
                        vendor: {
                            HTC: "APA",
                            Sprint: "Sprint"
                        }
                    }
                },
                os: {
                    windows: {
                        version: {
                            ME: "4.90",
                            "NT 3.11": "NT3.51",
                            "NT 4.0": "NT4.0",
                            2000: "NT 5.0",
                            XP: ["NT 5.1", "NT 5.2"],
                            Vista: "NT 6.0",
                            7: "NT 6.1",
                            8: "NT 6.2",
                            8.1: "NT 6.3",
                            10: ["NT 6.4", "NT 10.0"],
                            RT: "ARM"
                        },
                        name: {
                            "Windows Phone": "Windows Phone OS"
                        }
                    }
                }
            };
            var regexes = {
                browser: [
                    [/(opera\smini)\/([\w\.-]+)/i, /(opera\s[mobiletab]+).+version\/([\w\.-]+)/i, /(opera).+version\/([\w\.]+)/i, /(opera)[\/\s]+([\w\.]+)/i],
                    [
                        [NAME, mapper.str, maps.browser.name], VERSION
                    ],
                    [/\s(opr)\/([\w\.]+)/i],
                    [
                        [NAME, "Opera"], VERSION
                    ],
                    [/(kindle)\/([\w\.]+)/i, /(lunascape|maxthon|netfront|jasmine|blazer)[\/\s]?([\w\.]+)*/i, /(avant\s|iemobile|slim|baidu)(?:browser)?[\/\s]?([\w\.]*)/i, /(?:ms|\()(ie)\s([\w\.]+)/i, /(rekonq)\/([\w\.]+)*/i, /(chromium|flock|rockmelt|midori|epiphany|silk|skyfire|ovibrowser|bolt|iron|vivaldi)\/([\w\.-]+)/i],
                    [
                        [NAME, mapper.str, maps.browser.name], VERSION
                    ],
                    [/(trident).+rv[:\s]([\w\.]+).+like\sgecko/i, /(Edge)\/((\d+)?[\w\.]+)/i],
                    [
                        [NAME, "IE"], VERSION
                    ],
                    [/(yabrowser)\/([\w\.]+)/i],
                    [
                        [NAME, "Yandex"], VERSION
                    ],
                    [/(comodo_dragon)\/([\w\.]+)/i],
                    [
                        [NAME, /_/g, " "], VERSION
                    ],
                    [/((?:android.+)crmo|crios)\/([\w\.]+)/i, /android.+chrome\/([\w\.]+)\s+(?:mobile\s?safari)/i],
                    [
                        [NAME, "Chrome Mobile"], VERSION
                    ],
                    [/(chrome|omniweb|arora|[tizenoka]{5}\s?browser)\/v?([\w\.]+)/i, /(uc\s?browser|qqbrowser)[\/\s]?([\w\.]+)/i],
                    [NAME, VERSION],
                    [/(dolfin)\/([\w\.]+)/i],
                    [
                        [NAME, "Dolphin"], VERSION
                    ],
                    [/XiaoMi\/MiuiBrowser\/([\w\.]+)/i],
                    [VERSION, [NAME, "MIUI Browser"]],
                    [/android.+version\/([\w\.]+)\s+(?:mobile\s?safari|safari)/i],
                    [VERSION, [NAME, "Android Browser"]],
                    [/FBAV\/([\w\.]+);/i],
                    [VERSION, [NAME, "Facebook"]],
                    [/version\/([\w\.]+).+?mobile\/\w+\s(safari)/i],
                    [VERSION, [NAME, "Mobile Safari"]],
                    [/version\/([\w\.]+).+?(mobile\s?safari|safari)/i],
                    [VERSION, NAME],
                    [/webkit.+?(mobile\s?safari|safari)(\/[\w\.]+)/i],
                    [NAME, [VERSION, mapper.str, maps.browser.oldsafari.version]],
                    [/(konqueror)\/([\w\.]+)/i, /(webkit|khtml)\/([\w\.]+)/i],
                    [NAME, VERSION],
                    [/(blackberry)\\s?\/([\w\.]+)/i],
                    [
                        [NAME, "BlackBerry"], VERSION
                    ],
                    [/(navigator|netscape)\/([\w\.-]+)/i],
                    [
                        [NAME, "Netscape"], VERSION
                    ],
                    [/(swiftfox)/i, /(icedragon|iceweasel|camino|chimera|fennec|maemo\sbrowser|minimo|conkeror)[\/\s]?([\w\.\+]+)/i, /(firefox|seamonkey|k-meleon|icecat|iceape|firebird|phoenix)\/([\w\.-]+)/i, /(mozilla)\/([\w\.]+).+rv\:.+gecko\/\d+/i, /(polaris|lynx|dillo|icab|doris|amaya|w3m|netsurf)[\/\s]?([\w\.]+)/i, /(links)\s\(([\w\.]+)/i, /(gobrowser)\/?([\w\.]+)*/i, /(ice\s?browser)\/v?([\w\._]+)/i, /(mosaic)[\/\s]([\w\.]+)/i],
                    [NAME, VERSION]
                ],
                cpu: [
                    [/(?:(amd|x(?:(?:86|64)[_-])?|wow|win)64)[;\)]/i],
                    [
                        [ARCHITECTURE, "amd64"]
                    ],
                    [/(ia32(?=;))/i],
                    [
                        [ARCHITECTURE, util.lowerize]
                    ],
                    [/((?:i[346]|x)86)[;\)]/i],
                    [
                        [ARCHITECTURE, "ia32"]
                    ],
                    [/windows\s(ce|mobile);\sppc;/i],
                    [
                        [ARCHITECTURE, "arm"]
                    ],
                    [/((?:ppc|powerpc)(?:64)?)(?:\smac|;|\))/i],
                    [
                        [ARCHITECTURE, /ower/, "", util.lowerize]
                    ],
                    [/(sun4\w)[;\)]/i],
                    [
                        [ARCHITECTURE, "sparc"]
                    ],
                    [/((?:avr32|ia64(?=;))|68k(?=\))|arm(?:64|(?=v\d+;))|(?=atmel\s)avr|(?:irix|mips|sparc)(?:64)?(?=;)|pa-risc)/i],
                    [
                        [ARCHITECTURE, util.lowerize]
                    ]
                ],
                device: [
                    [/\((ipad|playbook);[\w\s\);-]+(rim|apple)/i],
                    [MODEL, VENDOR, [TYPE, TABLET]],
                    [/applecoremedia\/[\w\.]+ \((ipad)/],
                    [MODEL, [VENDOR, "Apple"],
                        [TYPE, TABLET]
                    ],
                    [/(apple\s{0,1}tv)/i],
                    [
                        [MODEL, "Apple TV"],
                        [VENDOR, "Apple"]
                    ],
                    [/(archos)\s(gamepad2?)/i, /(hp).+(touchpad)/i, /(kindle)\/([\w\.]+)/i, /\s(nook)[\w\s]+build\/(\w+)/i, /(dell)\s(strea[kpr\s\d]*[\dko])/i],
                    [VENDOR, MODEL, [TYPE, TABLET]],
                    [/(kf[A-z]+)\sbuild\/[\w\.]+.*silk\//i],
                    [MODEL, [VENDOR, "Amazon"],
                        [TYPE, TABLET]
                    ],
                    [/(sd|kf)[0349hijorstuw]+\sbuild\/[\w\.]+.*silk\//i],
                    [
                        [MODEL, mapper.str, maps.device.amazon.model],
                        [VENDOR, "Amazon"],
                        [TYPE, MOBILE]
                    ],
                    [/\((ip[honed|\s\w*]+);.+(apple)/i],
                    [MODEL, VENDOR, [TYPE, MOBILE]],
                    [/\((ip[honed|\s\w*]+);/i],
                    [MODEL, [VENDOR, "Apple"],
                        [TYPE, MOBILE]
                    ],
                    [/(blackberry)[\s-]?(\w+)/i, /(blackberry|benq|palm(?=\-)|sonyericsson|acer|asus|dell|huawei|meizu|motorola|polytron)[\s_-]?([\w-]+)*/i, /(hp)\s([\w\s]+\w)/i, /(asus)-?(\w+)/i],
                    [VENDOR, MODEL, [TYPE, MOBILE]],
                    [/\(bb10;\s(\w+)/i],
                    [MODEL, [VENDOR, "BlackBerry"],
                        [TYPE, MOBILE]
                    ],
                    [/android.+(transfo[prime\s]{4,10}\s\w+|eeepc|slider\s\w+|nexus 7)/i],
                    [MODEL, [VENDOR, "Asus"],
                        [TYPE, TABLET]
                    ],
                    [/(sony)\s(tablet\s[ps])\sbuild\//i, /(sony)?(?:sgp.+)\sbuild\//i],
                    [
                        [VENDOR, "Sony"],
                        [MODEL, "Xperia Tablet"],
                        [TYPE, TABLET]
                    ],
                    [/(?:sony)?(?:(?:(?:c|d)\d{4})|(?:so[-l].+))\sbuild\//i],
                    [
                        [VENDOR, "Sony"],
                        [MODEL, "Xperia Phone"],
                        [TYPE, MOBILE]
                    ],
                    [/\s(ouya)\s/i, /(nintendo)\s([wids3u]+)/i],
                    [VENDOR, MODEL, [TYPE, CONSOLE]],
                    [/android.+;\s(shield)\sbuild/i],
                    [MODEL, [VENDOR, "Nvidia"],
                        [TYPE, CONSOLE]
                    ],
                    [/(playstation\s[3portablevi]+)/i],
                    [MODEL, [VENDOR, "Sony"],
                        [TYPE, CONSOLE]
                    ],
                    [/(sprint\s(\w+))/i],
                    [
                        [VENDOR, mapper.str, maps.device.sprint.vendor],
                        [MODEL, mapper.str, maps.device.sprint.model],
                        [TYPE, MOBILE]
                    ],
                    [/(lenovo)\s?(S(?:5000|6000)+(?:[-][\w+]))/i],
                    [VENDOR, MODEL, [TYPE, TABLET]],
                    [/(htc)[;_\s-]+([\w\s]+(?=\))|\w+)*/i, /(zte)-(\w+)*/i, /(alcatel|geeksphone|huawei|lenovo|nexian|panasonic|(?=;\s)sony)[_\s-]?([\w-]+)*/i],
                    [VENDOR, [MODEL, /_/g, " "],
                        [TYPE, MOBILE]
                    ],
                    [/(nexus\s9)/i],
                    [MODEL, [VENDOR, "HTC"],
                        [TYPE, TABLET]
                    ],
                    [/[\s\(;](xbox(?:\sone)?)[\s\);]/i],
                    [MODEL, [VENDOR, "Microsoft"],
                        [TYPE, CONSOLE]
                    ],
                    [/(kin\.[onetw]{3})/i],
                    [
                        [MODEL, /\./g, " "],
                        [VENDOR, "Microsoft"],
                        [TYPE, MOBILE]
                    ],
                    [/\s(milestone|droid(?:[2-4x]|\s(?:bionic|x2|pro|razr))?(:?\s4g)?)[\w\s]+build\//i, /mot[\s-]?(\w+)*/i, /(XT\d{3,4}) build\//i],
                    [MODEL, [VENDOR, "Motorola"],
                        [TYPE, MOBILE]
                    ],
                    [/android.+\s(mz60\d|xoom[\s2]{0,2})\sbuild\//i],
                    [MODEL, [VENDOR, "Motorola"],
                        [TYPE, TABLET]
                    ],
                    [/android.+((sch-i[89]0\d|shw-m380s|gt-p\d{4}|gt-n8000|sgh-t8[56]9|nexus 10))/i, /((SM-T\w+))/i],
                    [
                        [VENDOR, "Samsung"], MODEL, [TYPE, TABLET]
                    ],
                    [/((s[cgp]h-\w+|gt-\w+|galaxy\snexus|sm-n900))/i, /(sam[sung]*)[\s-]*(\w+-?[\w-]*)*/i, /sec-((sgh\w+))/i],
                    [
                        [VENDOR, "Samsung"], MODEL, [TYPE, MOBILE]
                    ],
                    [/(samsung);smarttv/i],
                    [VENDOR, MODEL, [TYPE, SMARTTV]],
                    [/\(dtv[\);].+(aquos)/i],
                    [MODEL, [VENDOR, "Sharp"],
                        [TYPE, SMARTTV]
                    ],
                    [/sie-(\w+)*/i],
                    [MODEL, [VENDOR, "Siemens"],
                        [TYPE, MOBILE]
                    ],
                    [/(maemo|nokia).*(n900|lumia\s\d+)/i, /(nokia)[\s_-]?([\w-]+)*/i],
                    [
                        [VENDOR, "Nokia"], MODEL, [TYPE, MOBILE]
                    ],
                    [/android\s3\.[\s\w;-]{10}(a\d{3})/i],
                    [MODEL, [VENDOR, "Acer"],
                        [TYPE, TABLET]
                    ],
                    [/android\s3\.[\s\w;-]{10}(lg?)-([06cv9]{3,4})/i],
                    [
                        [VENDOR, "LG"], MODEL, [TYPE, TABLET]
                    ],
                    [/(lg) netcast\.tv/i],
                    [VENDOR, MODEL, [TYPE, SMARTTV]],
                    [/(nexus\s[45])/i, /lg[e;\s\/-]+(\w+)*/i],
                    [MODEL, [VENDOR, "LG"],
                        [TYPE, MOBILE]
                    ],
                    [/android.+(ideatab[a-z0-9\-\s]+)/i],
                    [MODEL, [VENDOR, "Lenovo"],
                        [TYPE, TABLET]
                    ],
                    [/linux;.+((jolla));/i],
                    [VENDOR, MODEL, [TYPE, MOBILE]],
                    [/((pebble))app\/[\d\.]+\s/i],
                    [VENDOR, MODEL, [TYPE, WEARABLE]],
                    [/android.+;\s(glass)\s\d/i],
                    [MODEL, [VENDOR, "Google"],
                        [TYPE, WEARABLE]
                    ],
                    [/android.+(\w+)\s+build\/hm\1/i, /android.+(hm[\s\-_]*note?[\s_]*(?:\d\w)?)\s+build/i, /android.+(mi[\s\-_]*(?:one|one[\s_]plus)?[\s_]*(?:\d\w)?)\s+build/i],
                    [
                        [MODEL, /_/g, " "],
                        [VENDOR, "Xiaomi"],
                        [TYPE, MOBILE]
                    ],
                    [/(mobile|tablet);.+rv\:.+gecko\//i],
                    [
                        [TYPE, util.lowerize], VENDOR, MODEL
                    ]
                ],
                engine: [
                    [/(presto)\/([\w\.]+)/i, /(webkit|trident|netfront|netsurf|amaya|lynx|w3m)\/([\w\.]+)/i, /(khtml|tasman|links)[\/\s]\(?([\w\.]+)/i, /(icab)[\/\s]([23]\.[\d\.]+)/i],
                    [NAME, VERSION],
                    [/rv\:([\w\.]+).*(gecko)/i],
                    [VERSION, NAME]
                ],
                os: [
                    [/microsoft\s(windows)\s(vista|xp)/i],
                    [NAME, VERSION],
                    [/(windows)\snt\s6\.2;\s(arm)/i, /(windows\sphone(?:\sos)*|windows\smobile|windows)[\s\/]?([ntce\d\.\s]+\w)/i],
                    [
                        [NAME, mapper.str, maps.os.windows.name],
                        [VERSION, mapper.str, maps.os.windows.version]
                    ],
                    [/(win(?=3|9|n)|win\s9x\s)([nt\d\.]+)/i],
                    [
                        [NAME, "Windows"],
                        [VERSION, mapper.str, maps.os.windows.version]
                    ],
                    [/\((bb)(10);/i],
                    [
                        [NAME, "BlackBerry"], VERSION
                    ],
                    [/(blackberry)\w*\/?([\w\.]+)*/i, /(tizen)[\/\s]([\w\.]+)/i, /(android|webos|palm\os|qnx|bada|rim\stablet\sos|meego|contiki)[\/\s-]?([\w\.]+)*/i, /linux;.+(sailfish);/i],
                    [NAME, VERSION],
                    [/(symbian\s?o?s?|symbos|s60(?=;))[\/\s-]?([\w\.]+)*/i],
                    [
                        [NAME, "Symbian"], VERSION
                    ],
                    [/\((series40);/i],
                    [NAME],
                    [/mozilla.+\(mobile;.+gecko.+firefox/i],
                    [
                        [NAME, "Firefox OS"], VERSION
                    ],
                    [/(nintendo|playstation)\s([wids3portablevu]+)/i, /(mint)[\/\s\(]?(\w+)*/i, /(mageia|vectorlinux)[;\s]/i, /(joli|[kxln]?ubuntu|debian|[open]*suse|gentoo|arch|slackware|fedora|mandriva|centos|pclinuxos|redhat|zenwalk|linpus)[\/\s-]?([\w\.-]+)*/i, /(hurd|linux)\s?([\w\.]+)*/i, /(gnu)\s?([\w\.]+)*/i],
                    [
                        [NAME, "Linux"], VERSION
                    ],
                    [/(cros)\s[\w]+\s([\w\.]+\w)/i],
                    [
                        [NAME, "Chromium OS"], VERSION
                    ],
                    [/(sunos)\s?([\w\.]+\d)*/i],
                    [
                        [NAME, "Solaris"], VERSION
                    ],
                    [/\s([frentopc-]{0,4}bsd|dragonfly)\s?([\w\.]+)*/i],
                    [
                        [NAME, "Linux"], VERSION
                    ],
                    [/(iphone)(?:.*os\s*([\w]+)*\slike\smac|;\sopera)/i],
                    [
                        [NAME, "iPhone"],
                        [VERSION, /_/g, "."]
                    ],
                    [/(ipad)(?:.*os\s*([\w]+)*\slike\smac|;\sopera)/i],
                    [
                        [NAME, "iPad"],
                        [VERSION, /_/g, "."]
                    ],
                    [/(mac\sos\sx)\s?([\w\s\.]+\w)*/i, /(macintosh|mac(?=_powerpc)\s)/i],
                    [
                        [NAME, "Mac"],
                        [VERSION, /_/g, "."]
                    ],
                    [/((?:open)?solaris)[\/\s-]?([\w\.]+)*/i, /(haiku)\s(\w+)/i, /(aix)\s((\d)(?=\.|\)|\s)[\w\.]*)*/i, /(plan\s9|minix|beos|os\/2|amigaos|morphos|risc\sos|openvms)/i, /(unix)\s?([\w\.]+)*/i],
                    [NAME, VERSION]
                ]
            };
            var UAParser = function(uastring, extensions) {
                if (!(this instanceof UAParser)) {
                    return new UAParser(uastring, extensions).getResult()
                }
                var ua = uastring || (window && window.navigator && window.navigator.userAgent ? window.navigator.userAgent : EMPTY);
                var rgxmap = extensions ? util.extend(regexes, extensions) : regexes;
                this.getBrowser = function() {
                    var browser = mapper.rgx.apply(this, rgxmap.browser);
                    browser.major = util.major(browser.version);
                    return browser
                };
                this.getCPU = function() {
                    return mapper.rgx.apply(this, rgxmap.cpu)
                };
                this.getDevice = function() {
                    return mapper.rgx.apply(this, rgxmap.device)
                };
                this.getEngine = function() {
                    return mapper.rgx.apply(this, rgxmap.engine)
                };
                this.getOS = function() {
                    return mapper.rgx.apply(this, rgxmap.os)
                };
                this.getResult = function() {
                    return {
                        ua: this.getUA(),
                        browser: this.getBrowser(),
                        engine: this.getEngine(),
                        os: this.getOS(),
                        device: this.getDevice(),
                        cpu: this.getCPU()
                    }
                };
                this.getUA = function() {
                    return ua
                };
                this.setUA = function(uastring) {
                    ua = uastring;
                    return this
                };
                this.setUA(ua);
                return this
            };
            UAParser.VERSION = LIBVERSION;
            UAParser.BROWSER = {
                NAME: NAME,
                MAJOR: MAJOR,
                VERSION: VERSION
            };
            UAParser.CPU = {
                ARCHITECTURE: ARCHITECTURE
            };
            UAParser.DEVICE = {
                MODEL: MODEL,
                VENDOR: VENDOR,
                TYPE: TYPE,
                CONSOLE: CONSOLE,
                MOBILE: MOBILE,
                SMARTTV: SMARTTV,
                TABLET: TABLET,
                WEARABLE: WEARABLE,
                EMBEDDED: EMBEDDED
            };
            UAParser.ENGINE = {
                NAME: NAME,
                VERSION: VERSION
            };
            UAParser.OS = {
                NAME: NAME,
                VERSION: VERSION
            };
            if (typeof exports !== UNDEF_TYPE) {
                if (typeof module !== UNDEF_TYPE && module.exports) {
                    exports = module.exports = UAParser
                }
                exports.UAParser = UAParser
            } else {
                if (typeof define === FUNC_TYPE && define.amd) {
                    define(function() {
                        return UAParser
                    })
                } else {
                    window.UAParser = UAParser
                }
            }
            var $ = window.jQuery || window.Zepto;
            if (typeof $ !== UNDEF_TYPE) {
                var parser = new UAParser;
                $.ua = parser.getResult();
                $.ua.get = function() {
                    return parser.getUA()
                };
                $.ua.set = function(uastring) {
                    parser.setUA(uastring);
                    var result = parser.getResult();
                    for (var prop in result) {
                        $.ua[prop] = result[prop]
                    }
                }
            }
        })(this)
    }, {}],
    11: [function(require, module, exports) {
        var uuid = function(a) {
            return a ? (a ^ Math.random() * 16 >> a / 4).toString(16) : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, uuid)
        };
        module.exports = uuid
    }, {}],
    12: [function(require, module, exports) {
        module.exports = "2.9.0"
    }, {}],
    13: [function(require, module, exports) {
        var type = require("./type");
        var AMP_OP_ADD = "$add";
        var AMP_OP_APPEND = "$append";
        var AMP_OP_CLEAR_ALL = "$clearAll";
        var AMP_OP_SET = "$set";
        var AMP_OP_SET_ONCE = "$setOnce";
        var AMP_OP_UNSET = "$unset";
        var log = function(s) {
            console.log("[Amplitude] " + s)
        };
        var Identify = function() {
            this.userPropertiesOperations = {};
            this.properties = []
        };
        Identify.prototype.add = function(property, value) {
            if (type(value) === "number" || type(value) === "string") {
                this._addOperation(AMP_OP_ADD, property, value)
            } else {
                log("Unsupported type for value: " + type(value) + ", expecting number or string")
            }
            return this
        };
        Identify.prototype.append = function(property, value) {
            this._addOperation(AMP_OP_APPEND, property, value);
            return this
        };
        Identify.prototype.clearAll = function() {
            if (Object.keys(this.userPropertiesOperations).length > 0) {
                if (!(AMP_OP_CLEAR_ALL in this.userPropertiesOperations)) {
                    log("Need to send $clearAll on its own Identify object without any other operations, skipping $clearAll")
                }
                return this
            }
            this.userPropertiesOperations[AMP_OP_CLEAR_ALL] = "-";
            return this
        };
        Identify.prototype.set = function(property, value) {
            this._addOperation(AMP_OP_SET, property, value);
            return this
        };
        Identify.prototype.setOnce = function(property, value) {
            this._addOperation(AMP_OP_SET_ONCE, property, value);
            return this
        };
        Identify.prototype.unset = function(property) {
            this._addOperation(AMP_OP_UNSET, property, "-");
            return this
        };
        Identify.prototype._addOperation = function(operation, property, value) {
            if (AMP_OP_CLEAR_ALL in this.userPropertiesOperations) {
                log("This identify already contains a $clearAll operation, skipping operation " + operation);
                return
            }
            if (this.properties.indexOf(property) !== -1) {
                log('User property "' + property + '" already used in this identify, skipping operation ' + operation);
                return
            }
            if (!(operation in this.userPropertiesOperations)) {
                this.userPropertiesOperations[operation] = {}
            }
            this.userPropertiesOperations[operation][property] = value;
            this.properties.push(property)
        };
        module.exports = Identify
    }, {
        "./type": 14
    }],
    14: [function(require, module, exports) {
        var toString = Object.prototype.toString;
        module.exports = function(val) {
            switch (toString.call(val)) {
                case "[object Date]":
                    return "date";
                case "[object RegExp]":
                    return "regexp";
                case "[object Arguments]":
                    return "arguments";
                case "[object Array]":
                    return "array";
                case "[object Error]":
                    return "error"
            }
            if (val === null) {
                return "null"
            }
            if (val === undefined) {
                return "undefined"
            }
            if (val !== val) {
                return "nan"
            }
            if (val && val.nodeType === 1) {
                return "element"
            }
            if (typeof Buffer !== "undefined" && Buffer.isBuffer(val)) {
                return "buffer"
            }
            val = val.valueOf ? val.valueOf() : Object.prototype.valueOf.apply(val);
            return typeof val
        }
    }, {}]
}, {}, {
    1: ""
}));
