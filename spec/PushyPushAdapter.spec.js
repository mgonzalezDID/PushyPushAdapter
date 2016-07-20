'use strict';

var PushyPushAdapter = require('../src/PushyPushAdapter').default;
var classifyInstallations = require('parse-server-push-adapter').utils.classifyInstallations;

// Make mock config
var pushConfig = {
  pushyApiKey:"API KEY"
};

describe('PushyPushAdapter', () => {
  it('can be initialized', (done) => {

    var pushyPushAdapter = new PushyPushAdapter(pushConfig);

    var senderMap = pushyPushAdapter.senderMap;

    expect(senderMap.ios instanceof Function).toBe(true);
    expect(senderMap.android instanceof Function).toBe(true);
    done();
  });

  it('cannot be initialized if options are missing', (done) => {

    expect(() => {
      new PushyPushAdapter();
    }).toThrow("Trying to initialize PushyPushAdapter pushyApiKey");
    done();
  });

  it('can get valid push types', (done) => {
    var pushyPushAdapter = new PushyPushAdapter(pushConfig);

    expect(pushyPushAdapter.getValidPushTypes()).toEqual(['ios', 'android']);
    done();
  });

  it('can classify installation', (done) => {
    // Mock installations
    var validPushTypes = ['ios', 'android'];
    var installations = [
      {
        deviceType: 'android',
        deviceToken: 'androidToken'
      },
      {
        deviceType: 'ios',
        deviceToken: 'iosToken'
      },
      {
        deviceType: 'win',
        deviceToken: 'winToken'
      },
      {
        deviceType: 'android',
        deviceToken: undefined
      }
    ];

    var deviceMap = PushyPushAdapter.classifyInstallations(installations, validPushTypes);
    expect(deviceMap['android']).toEqual([makeDevice('androidToken')]);
    expect(deviceMap['ios']).toEqual([makeDevice('iosToken')]);
    expect(deviceMap['win']).toBe(undefined);
    done();
  });


  it('can send push notifications', (done) => {
    var pushyPushAdapter = new PushyPushAdapter(pushConfig);

    // Mock android ios senders
    var androidSender = jasmine.createSpy('send')
    var iosSender = jasmine.createSpy('send')

    var senderMap = {
      ios: iosSender,
      android: androidSender
    };
    pushyPushAdapter.senderMap = senderMap;

    // Mock installations
    var installations = [
      {
        deviceType: 'android',
        deviceToken: 'androidToken'
      },
      {
        deviceType: 'ios',
        deviceToken: 'iosToken'
      },
      {
        deviceType: 'win',
        deviceToken: 'winToken'
      },
      {
        deviceType: 'android',
        deviceToken: undefined
      }
    ];
    var data = {};

    pushyPushAdapter.send(data, installations);
    // Check android sender
    expect(androidSender).toHaveBeenCalled();
    var args = androidSender.calls.first().args;
    expect(args[0]).toEqual(data);
    expect(args[1]).toEqual([
      makeDevice('androidToken')
    ]);
    // Check ios sender
    expect(iosSender).toHaveBeenCalled();
    args = iosSender.calls.first().args;
    expect(args[0]).toEqual(data);
    expect(args[1]).toEqual([
      makeDevice('iosToken')
    ]);
    done();
  });

  it("can send iOS notifications", (done) => {
  	var pushyPushAdapter = new PushyPushAdapter(pushConfig);
  	var sendToPushy = jasmine.createSpy('sendToPushy');
  	pushyPushAdapter.sendToPushy = sendToPushy;

  	pushyPushAdapter.sendToAPNS({'data':{
  		'badge': 1,
  		'alert': "Example content",
  		'sound': "Example sound",
  		'content-available': 1,
  		'misc-data': 'Example Data'
  	}},[{'deviceToken':'iosToken1'},{'deviceToken':'iosToken2'}])

  	expect(sendToPushy).toHaveBeenCalled();
  	var args = sendToPushy.calls.first().args;
  	expect(args[0]).toEqual({
  		'ios_badgeType':'SetTo',
  		'ios_badgeCount':1,
  		'contents': { 'en':'Example content'},
  		'ios_sound': 'Example sound',
  		'content_available':true,
  		'data':{'misc-data':'Example Data'},
  		'include_ios_tokens':['iosToken1','iosToken2']
  	})
  	done();
  });

  it("can send Android notifications", (done) => {
  	var pushyPushAdapter = new PushyPushAdapter(pushConfig);
  	var sendToPushy = jasmine.createSpy('sendToPushy');
  	pushyPushAdapter.sendToPushy = sendToPushy;

  	pushyPushAdapter.sendToGCM({'data':{
  		'title': 'Example title',
  		'alert': 'Example content',
  		'misc-data': 'Example Data'
  	}},[{'deviceToken':'androidToken1'},{'deviceToken':'androidToken2'}])

  	expect(sendToPushy).toHaveBeenCalled();
  	var args = sendToPushy.calls.first().args;
  	expect(args[0]).toEqual({
  		'contents': { 'en':'Example content'},
  		'title': {'en':'Example title'},
  		'data':{'misc-data':'Example Data'},
  		'include_android_reg_ids': ['androidToken1','androidToken2']
  	})
  	done();
  });

  it("can post the correct data", (done) => {

    var pushyPushAdapter = new PushyPushAdapter(pushConfig);

    var write = jasmine.createSpy('write');
    pushyPushAdapter.https = {
    	'request': function(a,b) {
    		return {
    			'end':function(){},
    			'on':function(a,b){},
    			'write':write
    		}
    	}
    };

    var installations = [
      {
        deviceType: 'android',
        deviceToken: 'androidToken'
      },
      {
        deviceType: 'ios',
        deviceToken: 'iosToken'
      },
      {
        deviceType: 'win',
        deviceToken: 'winToken'
      },
      {
        deviceType: 'android',
        deviceToken: undefined
      }
    ];

    pushyPushAdapter.send({'data':{
  		'title': 'Example title',
  		'alert': 'Example content',
  		'content-available':1,
  		'misc-data': 'Example Data'
  	}}, installations);

    expect(write).toHaveBeenCalled();

    // iOS
    let args = write.calls.first().args;
    expect(args[0]).toEqual(JSON.stringify({
  		'contents': { 'en':'Example content'},
  		'content_available':true,
  		'data':{'title':'Example title','misc-data':'Example Data'},
  		'include_ios_tokens':['iosToken'],
  		'app_id':'APP ID'
  		}));

    // Android
    args = write.calls.mostRecent().args;
    expect(args[0]).toEqual(JSON.stringify({
  		'contents': { 'en':'Example content'},
  		'title': {'en':'Example title'},
  		'data':{"content-available":1,'misc-data':'Example Data'},
  		'include_android_reg_ids':['androidToken'],
  		'app_id':'APP ID'
  		}));

    done();
  });

  function makeDevice(deviceToken, appIdentifier) {
    return {
      deviceToken: deviceToken,
      appIdentifier: appIdentifier
    };
  }

});