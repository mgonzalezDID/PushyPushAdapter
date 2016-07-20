"use strict";
// ParsePushAdapter is the default implementation of
// PushAdapter, it uses GCM for android push and APNS
// for ios push.

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PushyPushAdapter = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _parseServerPushAdapter = require('parse-server-push-adapter');

var _parseServerPushAdapter2 = _interopRequireDefault(_parseServerPushAdapter);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Parse = require('parse/node').Parse;
var deepcopy = require('deepcopy');

var PushyPushAdapter = exports.PushyPushAdapter = function () {
  function PushyPushAdapter() {
    var pushConfig = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, PushyPushAdapter);

    this.https = require('https');

    this.validPushTypes = ['ios', 'android'];
    this.senderMap = {};
    this.PushyConfig = {};
    var pushyApiKey = pushConfig.pushyApiKey;

    if (!pushyApiKey) {
      throw "Trying to initialize PushyPushAdapter without pushyApiKey";
    }
    this.PushyConfig['apiKey'] = pushConfig['pushyApiKey'];

    this.senderMap['ios'] = this.sendToAPNS.bind(this);
    this.senderMap['android'] = this.sendToGCM.bind(this);
  }

  _createClass(PushyPushAdapter, [{
    key: 'send',
    value: function send(data, installations) {
      var deviceMap = _parseServerPushAdapter.utils.classifyInstallations(installations, this.validPushTypes);

      var sendPromises = [];
      for (var pushType in deviceMap) {
        var sender = this.senderMap[pushType];
        if (!sender) {
          console.log('Can not find sender for push type %s, %j', pushType, data);
          continue;
        }
        var devices = deviceMap[pushType];

        if (devices.length > 0) {
          sendPromises.push(sender(data, devices));
        }
      }
      return Parse.Promise.when(sendPromises);
    }
  }, {
    key: 'getValidPushTypes',
    value: function getValidPushTypes() {
      return this.validPushTypes;
    }
  }, {
    key: 'sendToAPNS',
    value: function sendToAPNS(data, tokens) {

      data = deepcopy(data['data']);

      var post = {};
      if (data['badge']) {
        if (data['badge'] == "Increment") {
          post['ios_badgeType'] = 'Increase';
          post['ios_badgeCount'] = 1;
        } else {
          post['ios_badgeType'] = 'SetTo';
          post['ios_badgeCount'] = data['badge'];
        }
        delete data['badge'];
      }
      if (data['alert']) {
        post['contents'] = { en: data['alert'] };
        delete data['alert'];
      }
      if (data['sound']) {
        post['ios_sound'] = data['sound'];
        delete data['sound'];
      }
      if (data['content-available'] == 1) {
        post['content_available'] = true;
        delete data['content-available'];
      }
      post['data'] = data;

      var promise = new Parse.Promise();

      var chunk = 2000; // OneSignal can process 2000 devices at a time
      var tokenlength = tokens.length;
      var offset = 0;
      // handle onesignal response. Start next batch if there's not an error.
      var handleResponse = function (wasSuccessful) {
        if (!wasSuccessful) {
          return promise.reject("Pushy Error");
        }

        if (offset >= tokenlength) {
          promise.resolve();
        } else {
          this.sendNext();
        }
      }.bind(this);

      this.sendNext = function () {
        post['include_ios_tokens'] = [];
        tokens.slice(offset, offset + chunk).forEach(function (i) {
          post['include_ios_tokens'].push(i['deviceToken']);
        });
        offset += chunk;
        this.sendToOneSignal(post, handleResponse);
      }.bind(this);

      this.sendNext();

      return promise;
    }
  }, {
    key: 'sendToGCM',
    value: function sendToGCM(data, tokens) {
      data = deepcopy(data['data']);

      var post = {};

      if (data['alert']) {
        post['contents'] = { en: data['alert'] };
        delete data['alert'];
      }
      if (data['title']) {
        post['title'] = { en: data['title'] };
        delete data['title'];
      }
      if (data['uri']) {
        post['url'] = data['uri'];
      }

      post['data'] = data;

      var promise = new Parse.Promise();

      var chunk = 2000; // OneSignal can process 2000 devices at a time
      var tokenlength = tokens.length;
      var offset = 0;
      // handle onesignal response. Start next batch if there's not an error.
      var handleResponse = function (wasSuccessful) {
        if (!wasSuccessful) {
          return promise.reject("Pushy Error");
        }

        if (offset >= tokenlength) {
          promise.resolve();
        } else {
          this.sendNext();
        }
      }.bind(this);

      this.sendNext = function () {
        post['include_android_reg_ids'] = [];
        tokens.slice(offset, offset + chunk).forEach(function (i) {
          post['include_android_reg_ids'].push(i['deviceToken']);
        });
        offset += chunk;
        this.sendToPushy(post, handleResponse);
      }.bind(this);

      this.sendNext();
      return promise;
    }
  }, {
    key: 'sendToPushy',
    value: function sendToPushy(data, cb) {
      /****** PUSHY ******/
      var data = {
        message: 'Hello World!'
      };

      var tokens = ['APA91bG9PPbjR00hAGRwPyvLg9RLKF1EJ0hisvUeDakKgpK0XW5O7WrzlNc54snIqxn6IhpmSAQlcuAtL35YnTkX9EiJqUaq-On8d6TEugVz8HlVyXwMtDfUghwY20c6uQAS7cm6SXFdV9j2iP_v713Do0DlsDl4lQ'];

      pushyAPI.sendPushNotification(data, tokens, options, function (err, id) {
        if (err) {
          return console.log('Fatal Error', err);
        }
        console.log('Push sent successfully! (ID: ' + id + ')');
      });

      /****** END PUSHY ******/

      /*let headers = {
        "Content-Type": "application/json",
        "Authorization": "Basic "+this.OneSignalConfig['apiKey']
      };
      let options = {
        host: "onesignal.com",
        port: 443,
        path: "/api/v1/notifications",
        method: "POST",
        headers: headers
      };
      data['app_id'] = this.OneSignalConfig['appId'];
       let request = this.https.request(options, function(res) {
        if(res.statusCode < 299) {
          cb(true);
        } else {
          console.log('OneSignal Error');
          res.on('data', function(chunk) {
            console.log(chunk.toString())
          });
          cb(false)
        }
      });
      request.on('error', function(e) {
        console.log("Error connecting to OneSignal")
        console.log(e);
        cb(false);
      });
      request.write(JSON.stringify(data))
      request.end();*/
    }
  }], [{
    key: 'classifyInstallations',
    value: function classifyInstallations(installations, validTypes) {
      return _parseServerPushAdapter.utils.classifyInstallations(installations, validTypes);
    }
  }]);

  return PushyPushAdapter;
}();

exports.default = OneSignalPushAdapter;