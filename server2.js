// Server which delivers only static HTML pages (no content negotiation).
// Response codes: see http://en.wikipedia.org/wiki/List_of_HTTP_status_codes
// When the global data has been initialised, start the server.
var HTTP = require('http');
var FS = require('fs');
var url = require('url');
var path = require('path');
var QS = require('querystring');
var sql = require('sqlite3');
var db = new sql.Database("site.db");
//library to generate random keys 'generate key'
var rand = require('generate-key');

var OK = 200, NotFound = 404, BadType = 415;
start(4555);


const map = {
    '.ico': 'image/x-icon',
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword'
};

const sessions = {

};

// Provide a service to localhost only.
function start(port) {
  var service = HTTP.createServer(handle);
  service.listen(port, 'localhost');
  console.log("Visit localhost:" + port);
}

function isEmpty(obj){
  for (var key in obj){
    if(obj.hasOwnProperty(key))
    return false;
  }
  return true;
}

// Deal with a request.
function handle(request, response) {
  console.log(request.headers);

  var Url = request.url;
  console.log(Url);
  const parsedUrl = url.parse(request.url);
  let pathname = `${parsedUrl.pathname}`;
  var ext = path.parse(pathname).ext;
  pathname = "./public" + pathname;

  if (pathname.endsWith("/"))  {
    pathname = pathname + "index.html";
    ext = '.html';
  }
  if (request.method==='GET') {
    if(pathname.includes("artists")&&(!parseCookies(request))) {
      response.end("<p>You need to log in to access this area!</p>");
    }
    else if(pathname.includes("artists")&&pathname.includes("html")&&(parseCookies(request))) {
      //console.log(pathname);
      FS.readFile(pathname, "utf8", database);
      function database(err, source, ready) {
        var res = source.split("$$$");
        var topic;
        if(pathname.includes('drakekendrick')) topic = 'drakekendrick';
        else topic = 'jcolechildish';
        db.all("select * from Post where Topic = ?", topic, function(err, rows) {
        var str = '<table #battles align="center">';
        for(var i=0;i<rows.length;i++) {
          str+='<tr>';
          str+='<td>' + rows[i].User + '</td>' + '<td>' + rows[i].Post + '</td>';
          str+='</tr>';
        }
        str+='</table>';
        html = res[0] + str + res[1];
        var finale = html.split("£££");
        var final = finale[0] + topic + finale[1];
        reply(response, ext, err, final);
      });
    }

    }
    else if (pathname.includes("index")) {
      FS.readFile(pathname, "utf8", loggedin);
      function loggedin(err, data, ready) {
        var res = data.split("$$$");
        if(!isEmpty(sessions)) {
          var Cookies = request.headers['cookie'];
          var parsedCookie = Cookies.split("=");
          var user = sessions[parsedCookie[1]];
          var str = '<center><p>' + 'Logged in as ' + user + '</p></center>';
          var str = str + '<center><a href="http://localhost:4555/logout">LOGOUT</a><center>';
          html = res[0] + str + res[1];
          reply(response, ext, err, html)
        } else {
          var data = res[0] + res[1];
          reply(response, ext, err, data)
        }
      };

    }
    else if(pathname.includes("logout")) {
      var file = "./public/index.html";
      ext = '.html';
      FS.readFile(file, "utf8", logout);
      function logout(err, data, ready) {
        var Cookies = request.headers['cookie'];
        var parsedCookie = Cookies.split("=");
        delete sessions[parsedCookie[1]];
        var res = data.split("$$$");
        var data = res[0] + '<center><p>' + 'Logged out.' + '</p></center>' + res[1];
        reply(response, ext, err, data);
      }
    }
    else {
      FS.readFile(pathname, ready);
      function ready(err, data) {reply(response, ext, err, data)};
    }
  }
  if(request.method==='POST') {
    request.on('data', add);
    var body = "";
    function add(chunk) { body = body + chunk.toString(); }

    if(request.url==='/existinguser') {
      request.on('end', signin);
      function signin() {
        var params = QS.parse(body);
        db.each("SELECT * FROM users WHERE user='"+params.user+"'", process);
        function process(err, row) {
          if (err) throw err;
          response.setHeader('Content-Type', 'text/html');
          if (params.password1==row.password) {
            createCookie(response, params.user);
          }
          else response.end("<p>Username or password incorrect!</p>");
        }
      }
    }
    else if(request.url==='/newuser') {
      request.on('end', end);
      function end() {
        var params = QS.parse(body);
        response.setHeader('Content-Type', 'text/html');
        if(params.password1==params.password2) {
          //need to check passwords and username aren't empty string
          var ps = db.prepare("insert into users values (?,?,?)");
          ps.run(params.name, params.user, params.password1, function(err) {
            if(err) {
              console.log(err);
              response.end("<p>Username already taken!</p>");
            }
            else response.end("Account created successfully!")
          });
          ps.finalize();
        }
        else response.end("<p>Passwords don't match!</p>")
      }
    }
    //taking a post from a user
    else if(pathname.includes('/Post')) {
      request.on('end', end);
      function end() {
        var params = QS.parse(body);
        response.setHeader('Content-Type', 'text/html');
        var ps = db.prepare("insert into Post values (?,?,?)");
        var topic;
        if (Url.includes("jcolechildish")) {
          topic = "jcolechildish";
        }
        else topic = "drakekendrick";
        var Cookies = request.headers['cookie'];
        var parsedCookie = Cookies.split("=");
        ps.run(params.post, sessions[parsedCookie[1]], topic, function(err) {
          if(err) {
            console.log(err);
            response.end("<p>Post failed to be added!</p>");
          }
          else response.end("Posted!")
        });
      }
    }
  }
}

function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    var expires = "expires="+d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function createCookie(response, user) {
  //cookie will just be refreshed for different user.
  //ensure cookies are removed from map when logging in to different account - however problem here as we don't want users on different browsers to be logged out when others log in
  //i think the solution is remove key from map
  //server doesn't need to load into map on every launch? presume keys will be re distributed.
  var x = rand.generateKey(8); //generates 8 digit random key
  sessions[x]=user;
  console.log(sessions);
  console.log("x ="+ x);
	response.writeHead(200, {
    'Set-Cookie' : 'session='+x,
    'Content-Type' : 'text/plain'
  });
  response.end("Logged in!\n");
}

function reply(response, ext, err, data) {
  console.log(ext);
    if(err){
      response.statusCode = 500;
      response.end(`Error getting the file: ${err}.`);
    } else {
    // if the file is found, set Content-type and send data
    response.setHeader('Content-type', map[ext] || 'text/plain' );
    response.end(data);
  }
}

// Send a failure message
function fail(response, code, message) {
  var hdrs = { 'Content-Type': 'text/plain' };
  response.writeHead(code, hdrs);
  response.write(message);
  response.end();
}

function parseCookies(request) {
  var Cookies = request.headers['cookie'];
  console.log(Cookies);
  var parsedCookie = Cookies.split("=");
  console.log(parsedCookie);
  console.log(parsedCookie[1]);
  console.log(sessions);
  if(parsedCookie[1] in sessions) return true;
  else return false;
}
