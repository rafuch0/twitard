#!/usr/bin/env node

var DEBUG = { normal: false, packets: false };
var CONFIG = { prompt: 'twittard~# ', basedir: 'www-root', standalone: true, https: true, ports: { https: 8083, http: 8081 } };

var http = require('http');
var https = require('https');
var io = require('socket.io');
var util = require('util');
var fs = require('fs');
var repl = require('repl');
var path = require('path');
var Twitter = require('node-twitter');

var server;
if(CONFIG.standalone)
{
	if(CONFIG.https)
	{
		var serverCerts = {
		        key: fs.readFileSync('ServerConfig/server.key'),
		        cert: fs.readFileSync('ServerConfig/server.cert')
		};

		server = https.createServer(serverCerts, ServerMain);
		server.listen(CONFIG['ports'].https);
	}
	else
	{
		server = http.createServer(ServerMain);
		server.listen(CONFIG['ports'].http);
	}
}
else
{
	server = http.createServer(function(){});
	server.listen('1337');
}
var socket = io.listen(server);

var clientCount = 0;
var messageQueue = [];

var myRepl = repl.start({ input: process.stdin, output: process.stdout, prompt: CONFIG.prompt, useGlobal: true, ignoreUndefined: true, terminal: true, useColors: true });
myRepl['context'].DEBUG = DEBUG;

setupSocketIOOptions();
setupSocketIOEventHandlers();

setInterval(broadcastMessages, 1500);

var tCKey = 'hYvQl2xwzFQUyqjDlnr49Q';
var tCSecret = 'r5ER9Jzzwahl0KrZ4V5OcKq3GzgexMPQ1nPzjbzrzU';
var tTToken = '16153387-gYb0RqccS7Y1jCgiQE5yHZmlT8GEUwchYBzCnmedw';
var tTSecret = 'UAFoail5ZOcLIkdpBxleI44H9IppMCcmOkDvzmFUHkQ';

function setupSocketIOEventHandlers()
{
	socket.on('connection', NewClient);
}

function setupSocketIOOptions()
{
	socket.enable('browser client minification');
	socket.enable('browser client etag');
	socket.enable('browser client gzip');
	socket.set('log level', 0);
	if(DEBUG.packets) socket.set('log level', 3);
	socket.set('transports',
	[
		'websocket',
		'flashsocket',
		'htmlfile',
		'xhr-polling',
		'jsonp-polling'
	]);
}

process.on('SIGINT', function()
{
	cleanUp();

	setTimeout(process.exit, 100);
});

function cleanUp()
{
	twitterStreamClient.stop();
}

function getContentType(uri)
{
	var extension = uri.substr(-3);

	switch(extension)
	{
		case 'htm':
		case 'tml':
			return 'text/html';
		break;

		case 'css':
			return 'text/css';
		break;

		case '.js':
			return 'text/javascript';
		break;
	}
}

function ServerMain(request, response)
{
        var request_uri = './'+CONFIG.basedir+'/'+path.normalize('./'+((request.url == '' || request.url == '/')?'index.html':request.url));

	fs.exists(request_uri, function(exists)
	{
		if(exists)
		{
			fs.readFile(request_uri, function(error, content)
			{
				if(error)
				{
					response.writeHead(500);
					response.end();
				}
				else
				{
					response.writeHead(200, { 'Content-Type': getContentType(request_uri) });
					response.end(content, 'utf-8');
				}
			});
		}
		else
		{
			response.writeHead(404);
			response.end();
		}
	});	
}

var twitterStreamClient = getTwitterStreamClient();

function getTwitterStreamClient()
{
	newTwitterStreamClient = new Twitter.StreamClient(tCKey, tCSecret, tTToken, tTSecret);

	newTwitterStreamClient.on('close', function()
	{
		console.log('Connection closed.');
	});

	newTwitterStreamClient.on('end', function()
	{
		console.log('End of Line.');
	});

	newTwitterStreamClient.on('error', function(error)
	{
		console.log('Error: ' + (error.code ? error.code + ' ' + error.message : error.message));
	});

	newTwitterStreamClient.on('tweet', function(data)
	{
		console.log(util.inspect(data));

		for(var i = 0, maxi = twitterStreamClient['args']['keywords'].length; i < maxi; i++)
		{
			if(data['text'].toLowerCase().indexOf(twitterStreamClient['args']['keywords'][i]) !== -1)
			{
				broadcastClientMessage(twitterStreamClient['args']['keywords'][i],
				{
					type: 'stream', data: 
					{
						location: data['user'].location
						,text: data.text
						,image: data['user'].profile_image_url_https
						,screen_name: data['user'].screen_name
					}
				});
			}
		}
	});

	newTwitterStreamClient.args = { keywords: null, locations: null, users: null, count: 0 };

	return newTwitterStreamClient;
}

function NewClient(client)
{
	client.messageQueue = [];

	client.join('general');
	client.join('users');

	clientCount = socket.sockets.clients('users').length;
	console.log('Client Count: ' + clientCount);

	client.on('disconnect', function()
	{
		clientCount = socket.sockets.clients('users').length;
		console.log('Client Count: ' + clientCount);
	});

/*
	client.on('search', function(data)
	{
		var twitterSearchClient = new Twitter.SearchClient(tCKey, tCSecret, tTToken, tTSecret);

		twitterSearchClient.search({'q': data.data}, function(error, result)
		{
			if (error)
			{
				console.log('Error: ' + (error.code ? error.code + ' ' + error.message : error.message));
			}

			if (result)
			{
				queueClientMessage(client, { type: 'search', data: result });
			}
		});
	});


	client.on('streamremove', function(data)
	{
		if(data.keywords)
		{
			data.keywords = data.keywords.toLowerCase();

			client.part(data.keywords);

			if(twitterStreamClient['args']['keywords'].indexOf(data.keywords) !== -1)
			{
				if(twitterStreamClient.isRunning())
				{
					twitterStreamClient.stop();
					twitterStreamClient._connections = {};
				}

				twitterStreamClient.start(twitterStreamClient['args'].keywords, twitterStreamClient['args'].locations, twitterStreamClient['args'].users, twitterStreamClient['args'].count);
			}
	}

*/

	client.on('stream', function(data)
	{
		if(data.keywords)
		{
			data.keywords = data.keywords.toLowerCase();

			client.join(data.keywords);

			if(!twitterStreamClient['args']['keywords'])
			{
				twitterStreamClient['args']['keywords'] = [];
			}

			if(twitterStreamClient['args']['keywords'].indexOf(data.keywords) === -1)
			{
				if(twitterStreamClient['args']['keywords'].length > 10)
				{
					twitterStreamClient['args']['keywords'][0] = data.keywords;
				}
				else
				{
					twitterStreamClient['args']['keywords'].push(data.keywords);
				}

				if(twitterStreamClient.isRunning())
				{
					twitterStreamClient.stop();
					twitterStreamClient._connections = {};
				}

				twitterStreamClient.start(twitterStreamClient['args'].keywords, twitterStreamClient['args'].locations, twitterStreamClient['args'].users, twitterStreamClient['args'].count);
			}
		}
	});


/*
	client.on('home', function(data)
	{
		var twitterRestClient = new Twitter.RestClient(tCKey, tCSecret, tTToken, tTSecret);

		twitterRestClient.statusesHomeTimeline({}, function(error, result)
		{
			if(error)
			{
				console.log('Error: ' + (error.code ? error.code + ' ' + error.message : error.message));
			}
			else
			{
				if(result)
				{
					queueClientMessage(client, { type: 'home', data: result });
				}
			}
		});
	});
*/
}

function clone(data)
{
	return JSON.parse(JSON.stringify(data));
}

function getPadding(str, padCount, padChar)
{
	var pads = padCount - (str.toString().length + 1);

	if(pads > 0)
	{
		return Array(pads).join(padChar);
	}
	else
	{
		return '';
	}
}

function sendClientMessage(client, data)
{
	client.volatile.emit('message', data);
}

function broadcastClientMessage(channel, data)
{
	socket.sockets.in(channel).volatile.emit('message', data);
}

function queueClientMessage(client, data)
{
	client['messageQueue'].push(data);
}

function queueMessage(data)
{
	if(DEBUG.packets) console.log('%s', util.inspect(data));

	messageQueue.push(data);
}

function broadcastMessages()
{
	if(messageQueue.length > 0)
	{
		socket.sockets.in('general').volatile.emit('messageQueue', messageQueue);
		messageQueue = [];
	}

	var clients = socket.sockets.clients('users');
	if(clients.length > 0)
	{
		for(var i=0, maxi = clients.length; i < maxi; i++)
		{
			var client = clients[i];

			if(client['messageQueue'].length > 0)
			{
				client.volatile.emit('messageQueue', client.messageQueue);
				client.messageQueue = [];
			}
		}
	}
}
