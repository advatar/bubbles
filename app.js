var express = require('express')
  , http = require('http')
  , https = require('https')
  , path = require('path')
  , fs = require('fs')
  , sa = require("superagent")
  , _ = require("underscore")
  , async = require("async")

var app = express();

var config = process.env.CONFIG;

if (config)
{
  var UAA= config.uaa ? config.uaa : "http://uaa.run.pivotal.io";
  var API= config.api ? config.api :"http://api.run.pivotal.io";

}
 
console.log(config);

app.configure(function(){
  app.set('port', process.env.PORT || 2013);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.favicon());
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser('extra sensory perspiration'));
  app.use(express.session());
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});


app.get('/', function(req, res){
  res.render('index', { title: 'Bubbles',api:API});
});

app.get('/tree',checkAuth,function(req,res){
  res.render('tree', { title: 'Bubbles',data:'flare.json'});
}); 

app.get('/tree/:data',checkAuth,function(req,res){
  res.render('tree', { title: 'Bubbles',data:req.param('data')});
}); 

app.get('/bubbles',checkAuth,function(req,res){
  res.render('bubbles', { title: 'Bubbles',data:'flare.json'});
}); 

app.get('/bubbles/:data',checkAuth,function(req,res){
  res.render('bubbles', { title: 'Bubbles',data:req.param('data')});
}); 

app.get('/treemap',checkAuth,function(req,res){
  res.render('treemap', { title: 'Treemap' });
}); 

app.get('/apps',checkAuth,function(req,res){
  root = reset();
  token = req.session.access_token || req.cookies.access_token;
  async.waterfall(
    [
    function(callback){
      sa
      .get(API+'/v2/organizations')
      .set('Authorization', token)
      .set('Accept', 'application/json')
      .end(function(error, result){
        if (!error)
        {
          organizations = JSON.parse(result.text).resources;
          console.log(organizations);
          callback(null);
        }
        else
          callback(error);
      }); 
    },
    function(callback){
      sa
      .get(API+'/v2/spaces')
      .set('Authorization', token)
      .set('Accept', 'application/json')
      .end(function(error, result){
        if (!error)
        {
          spaces = JSON.parse(result.text).resources;
          console.log(spaces);
          callback(null);
        }
        else
          callback(error);
      }); 
    },
    function(callback){
      sa
      .get(API+'/v2/apps')
      .set('Authorization', token)
      .set('Accept', 'application/json')
      .end(function(error, result){
        if (!error)
        {
          applications = JSON.parse(result.text).resources;
          console.log(applications);
          callback(null);
        }
        else
          callback(error);
      }); 
    }/*,

    function(callback){
      // now dig a little deeper for runtime stats per app
      var q = async.queue(function (task, cb) {
        console.log('hello ' + task.entity.name);
        cb();
        }, 2);

      q.drain = function() {
        console.log('all items have been processed');
        callback();
      }
     q.push(applications, function (err) {
        console.log('finished processing bar');
      });
    }*/
    ],
    function (err) {
      if (!err){
        _.each(organizations,function(organization)
        {
          insert(root,organization,"-1");
        });

        _.each(spaces,function(space)
        {
          insert(organizations,space,space.entity.organization_guid);
        });

        _.each(applications,function(application)
        {
          insert(spaces,application,application.entity.space_guid);
        });
        res.json(root[0]); 
      }
      else
        console.err(err);   
  });
}); 

app.get('/users',checkAuth,function(req,res){
  root = reset();
  token = req.session.access_token || req.cookies.access_token;
  async.waterfall(
    [
    function(callback){
      sa
      .get(API+'/v2/organizations')
      .set('Authorization', token)
      .set('Accept', 'application/json')
      .end(function(error, result){
        if (!error)
        {
          organizations = JSON.parse(result.text).resources;
          callback(null);
        }
        else
          callback(error);
      }); 
    },
    function(callback){
      sa
      .get(API+'/v2/spaces')
      .set('Authorization', token)
      .set('Accept', 'application/json')
      .end(function(error, result){
        if (!error)
        {
          spaces = JSON.parse(result.text).resources;
          callback(null);
        }
        else
          callback(error);
      }); 
    },
    function(callback){
      sa
      .get(API+'/v2/users')
      .set('Authorization', token)
      .set('Accept', 'application/json')
      .end(function(error, result){
        if (!error)
        {
          users = JSON.parse(result.text).resources;
          console.log(users);
          callback(null);
        }
        else
          callback(error);
      }); 
    }
    ],
    function (err) {
      if (!err){
        _.each(organizations,function(organization)
        {
          insert(root,organization,"-1");
        });

        _.each(spaces,function(space)
        {
          insert(organizations,space,space.entity.organization_guid);
        });

        _.each(users,function(user)
        {
          insert(spaces,user,user.entity.space_guid);
        });
        res.json(root[0]); 
      }
      else
        console.err(err);   
  });
}); 

app.get('/login',function(req,res){
  getToken(
  {username: config.username, password: config.password},
  function (error,result) {
    if (!error) {
      req.session.access_token = "bearer "+JSON.parse(result.text).access_token;
      //console.log(req.session.access_token);
      // get user_id
      sa
      .get(UAA+'/userinfo')
      .set('Authorization', req.session.access_token)
      .set('Accept', 'application/json')
      .end(function(error, result){
        if (!error)
        {
          req.session.user_id=JSON.parse(result.text).user_id;
          res.cookie('access_token', req.session.access_token, { maxAge: 900000, httpOnly: false});
          res.cookie('user_id', req.session.user_id, { maxAge: 900000, httpOnly: false});
          console.log(req.session.access_token);
          console.log(req.session.user_id);
          res.redirect('/');
        }
        else
        {
          res.send(error);
        }      
      });  
    }
    else
    {
      res.send(error);
    }
  })
});

app.get('/logout', function (req, res) {
  delete req.session.user_id;
  delete req.session.access_token;
  delete req.cookies;
  res.redirect('/');
});    
function reset()
{
  return [{guid:-1,name:API,metadata:{guid:"-1"},children:[]}];
}

function checkAuth(req, res, next) {

  if (req.cookies.access_token && req.cookies.user_id)
    next();
  else if (config.token && config.user_id)
  {
    res.cookie('access_token', config.token, { maxAge: 900000, httpOnly: false});
    res.cookie('user_id', config.user_id, { maxAge: 900000, httpOnly: false});
    next();
  }
  else {
    res.redirect('/login');
  } 
}

function getToken(options, cont) {
  var body = {
    response_type: "token",
    grant_type: "password",
    username: options.username,
    password: options.password
  };
  sa.post(UAA+'/oauth/token')
    .send(body)
    .type('form')
    .set('Accept', 'application/json')
    .set('Authorization', 'Basic Y2Y6')
    .end(function (error, res) {
      cont(error,res);
    })
}

function find(parents, guid)
{
  for(i=0;i<parents.length;i++)
  {
    if (parents[i].metadata.guid==guid)
      return parents[i];
  }
  return null;
}

function insert(parents, node, guid)
{
  parent = find(parents,guid);
  if (!parent)
  {
    return null;
  }
  if (!parent.children)
  {
    parent.children = [];
  }
  if (!node.name)
    node.name = node.entity.name;
  if (!node.size)
    node.size = 100;
  
  if (node.entity.instances)
  {
    quota = {guid:-1,name:" ",children:[{name:node.entity.memory+"M",size:100},{name:node.entity.disk_quota+"G",size:100}]};
    if (!node.children) 
      node.children=[];
    node.children.push(quota);
    console.log(quota);
  }
  parent.children.push(node);
}

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
