/*

Botkit Studio Skill module to enhance the "prerelease" script

*/
var http = require('http');
var request = require('../utils/async-request');

module.exports = function(controller) {
    controller.hears(['last build'], 'direct_message,direct_mention', function(bot, message) {
      var url = 'https://circleci.com/api/v1.1/project/github/lynckia/licode?circle-token=' + process.env.circleCi_token;
      request({url:url, json:true}).then(function(body) {
        console.log('body', body);
        if (body && body.length > 0) {
          var build = body[0];
          console.log(build);
          var reply_with_attachments = {
            'text': 'Last build is ' + build.status + ' in branch ' + build.branch,
            };

          bot.reply(message, reply_with_attachments);
        }
      }).catch(function(error) {
        bot.reply(message, "Error connecting to CircleCI");
      });
    });
  
    controller.hears(['build (.*)'], 'direct_message,direct_mention', function(bot, message) {
      var commit = message.match[1];
      var url = 'https://circleci.com/api/v1.1/project/github/lynckia/licode/tree/master?circle-token=' + process.env.circleCi_token;
      request({url:url, json:true, method: 'POST', form: {'build_parameters[CIRCLE_JOB]':'build','revision':commit}}).then(function(body) {
        if (body && body.length > 0) {
          var build = body[0];
          var reply_with_attachments = {
            'text': 'Build started',
            };

          bot.reply(message, reply_with_attachments);
        }
      }).catch(function(error) {
        bot.reply(message, "Error connecting to CircleCI");
      });
    });
  
    var github = function(url, method) {
      console.log(url, method);
      return request({url:url, 
                    json:true, 
                    method:method,
                    headers: {
                      'User-Agent': 'licodeBot'
                    },
                    auth: {
                      user: process.env.githubUser,
                      pass: process.env.githubToken,
                      'sendImmediately': true
                    }});
    };
  
    var createRelease = function(bot, message, mode, name, commit='') {
      var url = 'https://circleci.com/api/v1.1/project/github/lynckia/licode/tree/master?circle-token=' + process.env.circleCi_token;
      request({url:url, json:true, method: 'POST', form: {'build_parameters[RELEASE_VERSION]':name,'build_parameters[CIRCLE_JOB]':mode,'revision':commit}}).then(function(body) {
        if (body) {
          var build_url = 'https://circleci.com/api/v1.1/project/github/lynckia/licode/' + body.build_num;
          var reply_with_attachments = {
            'text': 'CircleCI started to create the ' + mode + ' ' + name,
            };
          
          if (!body.lifecycle || body.lifecycle === 'finished') {
            var reply_with_attachments = {
                    'text': 'CircleCI failed with status ' + body.status,
                  };
            if (body.message) {
              reply_with_attachments = {
                    'text': 'CircleCI failed with message ' + body.message,
                  };
            }
            bot.reply(message, reply_with_attachments);
            return;
          }
          bot.reply(message, reply_with_attachments);
          
          var timer = setInterval(function() {
            console.log("Checking...");
            request({url:build_url + '?circle-token=' + process.env.circleCi_token, method:'GET', json:true}).then(function(body) {
              if (body.lifecycle === 'finished') {
                clearInterval(timer);
                var reply_with_attachments = {
                    'text': 'CircleCI finished with status ' + body.status,
                  };
                if (body.status === 'success') {
                  reply_with_attachments = {
                    'text': 'CircleCI finished ' + mode + ' ' + name,
                  };
                }
                bot.reply(message, reply_with_attachments);
              }
            }).catch(function(error) {
              console.log('Could not access circleci', error);
              clearInterval(timer);
            });
          }, 5 * 1000);
          setTimeout(function() {
            clearInterval(timer);
          }, 15 * 60 * 1000);
        }
      }).catch(function(error) {
        console.log(error);
        bot.reply(message, "Error connecting to CircleCI");
      });
    };  
  
    controller.hears(['create prerelease (v.*) from (.*)'], 'direct_message,direct_mention', function(bot, message) {
      var name = message.match[1];
      var commit = message.match[2];
      createRelease(bot, message, 'prerelease', name, commit);
    });
  
    controller.hears(['create release (v.*)'], 'direct_message,direct_mention', function(bot, message) {
      var name = message.match[1];
      createRelease(bot, message, 'release', name);
    });
  
    controller.hears(['git log'], 'direct_message,direct_mention', function(bot, message) {
      var url = 'https://api.github.com/repos/lynckia/licode/commits';
      github(url, 'get').then(function(body) {
        var text = '';
        for (var commit of body) {
          text += '<' + commit.html_url + '|' + commit.sha.substr(0,7) + '> ' + commit.author.login + ' ' + commit.commit.message + '\n';
        }
        var reply_with_attachments = {
          'attachments': [
            {
              'title': 'Commits',
                  'text': text,
                  'fallback': text,
                  'color': '#7CD197'
            }
          ],
          };

        bot.reply(message, reply_with_attachments);
      });
    });
  
    controller.hears(['releases'], 'direct_message,direct_mention', function(bot, message) {
      var url = 'https://api.github.com/repos/lynckia/licode/releases';
      github(url, 'get').then(function(body) {
        var text = '';
        for (var release of body) {
          console.log(release);
          text += '<' + release.html_url + '|' + release.tag_name + '> ' + (release.prerelease ? '(prerelease) ':'') + release.name + ' ' + release.target_commitish + '\n';
        }
        var reply_with_attachments = {
          'attachments': [
            {
              'title': 'Releases',
              'text': text,
              'fallback': text,
              'color': '#7CD197'
            }
          ]};

        bot.reply(message, reply_with_attachments);
      });
    });

    // Before the prerelease thread starts, run this:
    controller.studio.beforeThread('prerelease','prerelease', function(convo, next) {

        // always call next!
        next();
    });
}
