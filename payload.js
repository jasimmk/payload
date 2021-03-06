/*!
 * Payload.js Javascript Library
 *
 * Copyright (c) 2015, Philip Klauzinski (http://gui.ninja)
 * Released under the MIT license
 * http://www.opensource.org/licenses/mit-license.php
 *
 * @author Philip Klauzinski
 * @version 0.1.3
 * @requires jQuery v1.7+
 * @preserve
 */
(function(root, factory) {

    'use strict';

    if (typeof define === 'function' && define.amd) {
        // AMD
        define(['jquery'], factory);
    } else if (typeof exports === 'object') {
        // Node
        module.exports = factory(require('jquery'));
    } else {
        // Browser globals
        root.Payload = factory(root.jQuery);
    }

}(this, function($) {

    'use strict';

    var Payload = function() {

        var _this = this, _$context, _lastTemplate,

            _options = {
                apiCallback: $.noop,
                apiOnClick: function() {
                    return true;
                },
                apiOnSubmit: function() {
                    return true;
                },
                apiAfterRender: $.noop,
                apiAccessToken: false,
                apiResponseParent: false,
                context: document.body,
                dataNamespace: false,
                debug: false,
                loadingHtml: '<small>Loading...</small>',
                useHref: false,
                xhrAlways: $.noop,
                xhrBeforeSend: $.noop,
                xhrDone: $.noop,
                xhrFail: $.noop
            },

            _dataPrefix = 'data-' + (_options.dataNamespace ? $.trim(_options.dataNamespace) + '-' : ''),

            _selectors = {
                API_LINK: 'a[' + _dataPrefix + 'selector],a[' + _dataPrefix + 'url],button[' + _dataPrefix + 'selector],button[' + _dataPrefix + 'url]',
                API_FORM: 'form[' + _dataPrefix + 'selector],form[' + _dataPrefix + 'url]',
                AUTO_LOAD: '[' + _dataPrefix + 'auto-load="true"]',
                CLICK: '[' + _dataPrefix + 'click]',
                LOADING: '[' + _dataPrefix + 'role="loading"]'
            },

            _cache = {
                response: {},
                view: {}
            },

            _$events = $({}),

            // Safe console debug - http://klauzinski.com/javascript/safe-firebug-console-in-javascript
            _debug = function(m) {
                var args, sMethod;
                if (_options.debug && typeof console === 'object' && (typeof m === 'object' || typeof console[m] === 'function')) {
                    if (typeof m === 'object') {
                        for (sMethod in m) {
                            if (typeof console[sMethod] === 'function') {
                                args = (typeof m[sMethod] === 'string' || (typeof m[sMethod] === 'object' && m[sMethod].length === undefined)) ? [m[sMethod]] : m[sMethod];
                                console[sMethod].apply(console, args);
                            } else {
                                console.log(m[sMethod]);
                            }
                        }
                    } else {
                        console[m].apply(console, Array.prototype.slice.call(arguments, 1));
                    }
                }
            },

            _error = function(text) {
                throw 'Payload.js: ' + text;
            },

            _initialize = function() {
                _$context = $(_options.context);
                if (!_$context.length) {
                    _error('Selector "' + _options.context + '" not found');
                }
                _initDelegatedBehaviors();
                return _this;
            },

            _initDelegatedBehaviors = function() {
                _delegateApiRequests();
                _delegateClicks();
            },

            // Delegation methods

            _delegateApiRequests = function() {
                _$context.on('click.api-request auto-load.api-request', _selectors.API_LINK, function(e) {
                    //var $this = $(this).closest('[' + _dataPrefix + 'selector]');
                    var $this = $(this);
                    e.preventDefault();
                    if ($this.prop('disabled') || $this.hasClass('disabled') || $this.data('disabled')) {
                        return;
                    }
                    if (_options.apiOnClick($this, e)) {
                        _this.apiRequest($this);
                    }
                }).on('submit.api-request', _selectors.API_FORM, function(e) {
                    var $this = $(this);
                    e.preventDefault();
                    if (_options.apiOnSubmit($this, e)) {
                        _this.apiRequest($this);
                    }
                });
            },

            _delegateClicks = function() {
                _$context.on('click.click', _selectors.CLICK, function(e) {
                    var $this = $(this),
                        $click = $($this.attr(_dataPrefix + 'click'));

                    e.preventDefault();
                    $click.click();
                });
            },

            // Caching

            _cacheView = function($origin, api, templateName) {
                var selector = api.selector,
                    $selector = $(selector), key, current;

                if ($origin.closest(selector).length) {
                    return;
                }

                if (_cache.view[selector]) {
                    for (key in _cache.view[selector]) {
                        if (_cache.view[selector].hasOwnProperty(key) && _cache.view[selector][key].html === null) {
                            _cache.view[selector][key].html = $selector.contents().detach();
                            current = key;
                            break;
                        }
                    }
                } else if (api.cacheView) {
                    _cache.view[selector] = {};
                }

                if (api.cacheView) {
                    if (_cache.view[selector][templateName] && templateName !== current) {
                        _cache.view[selector][templateName].html = null;
                    } else if (!_cache.view[selector][templateName]) {
                        _cache.view[selector][templateName] = {
                            html: null,
                            done: $.noop
                        };
                    }
                    _lastTemplate = templateName;
                } else {
                    _lastTemplate = null;
                }
            }

            ; // End var declaration

        /**
         * Public vars and methods
         */

        this.options = _options;

        this.appData = {};

        this.cache = _cache;

        this.debug = _debug;

        this.deliver = function(opts) {
            if (typeof(opts) === 'function') {
                _options.apiCallback = opts;
            } else if (typeof(opts) === 'object') {
                _this.merge(opts);
            } else if (typeof(opts) === 'string') {
                _options.context = opts;
            }
            return _initialize();
        };

        this.merge = function(opts) {
            return $.extend(_options, opts);
        };

        this.apiRequest = function($this) {
            var api = {
                    href: $this.attr('href'),
                    url: $this.attr(_dataPrefix + 'url') || $this.attr('action'),
                    method: ($this.attr(_dataPrefix + 'method') || $this.attr('method') || 'get').toLowerCase(),
                    cacheRequest: $this.attr(_dataPrefix + 'cache-request') || false,
                    cacheResponse: $this.attr(_dataPrefix + 'cache-response') || false,
                    cacheView: $this.attr(_dataPrefix + 'cache-view') || false,
                    focus: JSON.parse($this.attr(_dataPrefix + 'focus') || false),
                    type: $this.attr(_dataPrefix + 'type') || 'json',
                    selector: $this.attr(_dataPrefix + 'selector') || false,
                    template: Handlebars.templates[$this.attr(_dataPrefix + 'template')] || false,
                    partial: Handlebars.partials[$this.attr(_dataPrefix + 'partial')] || false,
                    events: $this.attr(_dataPrefix + 'publish') ? $this.attr(_dataPrefix + 'publish').split(' ') : [],
                    title: $this.attr(_dataPrefix + 'title') || $this.attr('title') || $this.text(),
                    requestData: $.extend({}, _this.serializeObject($this), JSON.parse($this.attr(_dataPrefix + 'form') || '{}')),
                    templateData: {
                        app: _this.appData,
                        view: $this.data()
                    }
                },
                publishEvents = function(args) {
                    var i = 0;
                    for (i; i < api.events.length; i++) {
                        _this.publish(api.events[i], args || []);
                    }
                },
                templateName = $this.attr(_dataPrefix + 'template') || $this.attr(_dataPrefix + 'partial'),
                requestKey = api.url + $this.serialize(),
                $selector, $loading, $load, html, templateData, params;

            // Add the request payload to the template data under "request" namespace
            api.templateData.request = api.requestData;

            // If caching is invoked and this is the last template loaded, do nothing
            if (api.cacheView && _lastTemplate === templateName) {
                return;
            }

            api.loading = ($this.attr(_dataPrefix + 'loading') ? JSON.parse($this.attr(_dataPrefix + 'loading')) : (api.method === 'get'));

            // Begin template sequence
            if (api.url || api.selector && (api.template || api.partial)) {
                $selector = $(api.selector);
                $loading = $selector.find('[' + _dataPrefix + 'role="loading"]');
                params = {
                    $origin: $this,
                    $target: $selector,
                    api: api
                };

                if (api.cacheView &&
                    _cache.view[api.selector] &&
                    _cache.view[api.selector][templateName] &&
                    _cache.view[api.selector][templateName].html !== null
                ) {
                    html = _cache.view[api.selector][templateName].html;
                    _cacheView($this, api, templateName);
                    $selector.html(html);
                    _options.apiAfterRender(params);
                    _cache.view[api.selector][templateName].done();
                    api.url = false;
                } else if (!api.url) {
                    html = api.template ? api.template(api.templateData) : api.partial(api.templateData);
                    _cacheView($this, api, templateName);
                    $selector.html(html);
                    _options.apiAfterRender(params);
                }

                _options.apiCallback(params);

                if (!api.url) {
                    publishEvents([params]);
                    return;
                }

                _cacheView($this, api, templateName);

                if (api.cacheResponse && _cache.response[requestKey] && _cache.response[requestKey].data && _cache.response[requestKey].done) {
                    templateData = $.extend({}, _cache.response[requestKey].data, api.templateData);
                    html = api.template ? api.template(templateData) : api.partial(templateData);
                    $selector.html(html);
                    _options.apiAfterRender(params);
                    _cache.response[requestKey].done();
                    publishEvents([params]);
                    return;
                }
                if (api.loading) {
                    $load = $(_options.loadingHtml).attr(_dataPrefix + 'role', 'loading');
                    $selector.empty().prepend($load);
                } else if ($loading.length) {
                    $loading.removeClass('hidden').show();
                }

                // Is there an access token?
                if (_options.apiAccessToken) {
                    api.requestData.access_token = _options.apiAccessToken;
                }

                $.ajax({
                    url: api.url,
                    type: api.method,
                    dataType: api.type,
                    data: (api.method === 'get') ? api.requestData : JSON.stringify(api.requestData),
                    contentType: 'application/json',
                    cache: api.cacheRequest,
                    beforeSend: function(jqXHR, settings) {
                        if (_options.apiAccessToken) {
                            jqXHR.setRequestHeader('Authorization', 'Bearer ' + _options.apiAccessToken);
                        }
                        _options.xhrBeforeSend({
                            jqXHR: jqXHR,
                            settings: settings,
                            $origin: $this,
                            $target: $selector,
                            api: api
                        });
                    }
                }).done(function(response, status, jqXHR) {
                    var responseData = _options.apiResponseParent ? response[_options.apiResponseParent] : response,
                        templateData = $.extend({}, api.templateData, $.isArray(responseData) ? { data: responseData } : responseData),
                        html = templateName ? (api.template ? api.template(templateData) : api.partial(templateData)) : false,
                        params = {
                            response: response,
                            status: status,
                            jqXHR: jqXHR,
                            $origin: $this,
                            $target: $selector,
                            html: html,
                            api: $.extend(api, { templateData: templateData })
                        },
                        xhrDone = function() {
                            _options.xhrDone(params);
                            _this.triggerAutoLoad($selector.find(_selectors.AUTO_LOAD));
                        };

                    if ($selector.length && api.loading) {
                        $selector.find(_selectors.LOADING).first().fadeOut(100, function() {
                            $selector.html(html);
                            _options.apiAfterRender(params);
                            xhrDone();
                            publishEvents([params]);
                        });
                    } else {
                        if ($selector.length && (api.method === 'get' || $loading.length)) {
                            $selector.html(html);
                            _options.apiAfterRender(params);
                        }
                        xhrDone();
                        publishEvents([params]);
                    }

                    if (api.cacheResponse) {
                        _cache.response[requestKey] = {
                            data: templateData,
                            done: xhrDone
                        };
                    } else if (api.cacheView) {
                        _cache.view[api.selector][templateName].done = xhrDone;
                    }
                }).fail(function(jqXHR, status, error) {
                    _options.xhrFail({
                        jqXHR: jqXHR,
                        status: status,
                        error: error,
                        $origin: $this,
                        $target: $selector,
                        api: api
                    });
                }).always(function(responseORjqXHR, status, jqXHRorError) {
                    var success = (status === 'success');
                    _options.xhrAlways({
                        response: success ? responseORjqXHR : null,
                        jqXHR: (status === 'success') ? jqXHRorError : responseORjqXHR,
                        status: status,
                        error: success ? null : jqXHRorError,
                        $origin: $this,
                        $target: $selector,
                        api: api
                    });
                });
            }
        };

        this.triggerAutoLoad = function(node) {
            $(node || _selectors.AUTO_LOAD).trigger('auto-load');
        };

        this.publish = function() {
            _$events.trigger.apply(_$events, arguments);
            _debug('info', '"' + arguments[0] + '"', 'event published.');
        };

        this.subscribe = function() {
            _$events.on.apply(_$events, arguments);
        };

        this.unsubscribe = function() {
            _$events.off.apply(_$events, arguments);
        };

        this.serializeObject = function($form) {
            var o = {},
                a = $form.serializeArray();

            $.each(a, function() {
                if (o[this.name] !== undefined) {
                    if (!o[this.name].push) {
                        o[this.name] = [o[this.name]];
                    }
                    o[this.name].push(this.value || '');
                } else {
                    o[this.name] = this.value || '';
                }
            });
            return o;
        };

    };

    return new Payload();

}));