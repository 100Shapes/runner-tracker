var Types = require('joi');
var _ = require('lodash');

var ua = require('universal-analytics');
var visitor = ua('UA-27923958-9');

var Datastore = require('nedb');
db = {};
db.runners = new Datastore({ filename: 'db/runners', autoload: true });
db.laps = new Datastore({ filename: 'db/laps', autoload: true });
db.comps = new Datastore({ filename: 'db/comp', autoload: true });
db.teams = new Datastore({ filename: 'db/teams', autoload: true });

module.exports = function(server) {

    db.comps.findOne({ current: true }, function(err, current){
      server.app.current = current._id
      console.log('Current Comp:', current.name)
    });

    server.method('getRunners', function (next) {
        db.runners.find({ comp_id : server.app.current }, next);
    });

    server.method('getRunnerByID', function (bid, next) {
        db.runners.findOne({ bid: bid, comp_id : server.app.current }, next);
    });

    server.method('addRunner', function (runner, next) {
        runner.comp_id = server.app.current
        db.runners.insert(runner, function(err, new_runner){
          if (runner.team_id) {
            server.method.addRunnerToTeam(new_runner._id, runner.team_id)
            new_runner.team_id = runner.team_id
          }
          next(err, new_runner)
        });
    });

    server.method('addTeam', function (team, next) {
        team.comp_id = server.app.current
        db.teams.insert(team, next);
    });

    server.method('getTeams', function (next) {
        db.teams.find({ comp_id : server.app.current }, next);
    });

    server.method('addRunnerToTeam', function (runner_id, team_id, next) {
        db.teams.update({ _id : team_id }, { $push: { runners: runner_id } }, next);
    });

    server.method('getLaps', function (next) {
        db.laps.find({ comp_id : server.app.current }, next);
    });

    server.method('getLapsByID', function (bid, next) {
        db.laps.find({ bid: bid, comp_id : server.app.current }, next);
    });

    server.method('getLastLapByID', function (bid, next) {
        db.laps.findOne({ bid: bid, comp_id : server.app.current }).sort({ time: -1 }).exec(next);
    });

    server.method('addLap', function (lap, next) {
      lap.comp_id = server.app.current
      db.laps.insert(lap, next);

      // db.laps.findOne({ bid: lap.bid, comp_id : server.app.current }).sort({ time: -1 }).exec(function (err, lastlap) {
      //   if (lastlap) {
      //     lap.diff =  lap.time - lastlap.time
      //     console.log("diff:", lap.diff);
      //     if (lap.diff > (2 * 60 * 1000)) {
      //       lap.comp_id = server.app.current
      //       db.laps.insert(lap, next);
      //     } else {
      //       console.log("time infingment:", lap.diff, lap.bid);
      //     }
      //   } else {
      //       lap.diff = 0
      //       db.laps.insert(lap, next);
      //   }
      // })
    });

    server.method('getComp', function (comp_id, next) {
        db.comps.findOne({ _id: comp_id }, next);
    });

    server.method('getComps', function (next) {
        db.comps.find({ }, next);
    });

    server.method('getCurrentComp', function (next) {
        db.comps.findOne({ current: true }, function(err, current){
          server.app.current = current._id
          next(err, current)
        });
    });

    server.method('setCurrentComp', function (comp_id, next) {
        server.app.current = comp_id
        db.comps.update({ current: true }, { $unset: { current: true }})
        db.comps.update({ _id: comp_id }, { $set: {current: true}}, next)
    });

    server.method('addComp', function (comp, next) {
        db.comps.insert(comp, next);
    });

    server.method('getTop', function (next) {
        var top = [];
        console.log(server.app.current)
        db.runners.find({comp_id : server.app.current}, function(err, runners) {
            _.forEach(runners, function(runner, i) {
                db.laps.find({ bid: runner.bid, comp_id : server.app.current }, function(err, laps) {
                    if (laps) {
                        top.push({
                            name: runner.name,
                            laps: laps.length,
                            bid: runner.bid
                        })
                    }
                    if (i == runners.length-1) {
                        top = _.sortBy(top, 'laps').reverse();
                        next(top);
                    }
                })
            })
        })
    });

    server.method('logLap', function (lap) {
        visitor.event({
            ec:'Runner Tracking',
            ea:'Runner Passed',
            el: lap.time,
            ev: lap.bid
        }, function (err) {
            if (err){console.log(err)};
        });
    });
};
