var MAX_MESSAGES = { max: 150, bufferZone: 75 };
var DEBUG = { showRenderTime: false };

var socket = io.connect('/');

//socket.on('connect', requestHome);
socket.on('messageQueue', recieveMessages);
socket.on('message', function(data)
{
	recieveMessages([ data ]);
});

setInterval(updatePage, 1500);

var autoScroll = 1;

var theData = [];

var colorCodeMemoized = _.memoize(colorCode);
var colorCodeInverseMemoized = _.memoize(colorCodeInverse);

var streamKeywords;

function requestStream()
{
	var streamKeyword = document.getElementById('streamInput').value;

	if(streamKeyword)
	{
		streamKeyword = streamKeyword.toLowerCase();

		if(!streamKeywords)
		{
			streamKeywords = [];
		}

		if(streamKeywords.indexOf() === -1)
		{
			streamKeywords.push(streamKeyword);

			var streamLocations = null;
			var streamUsers = null;
			socket.emit('stream', { type: 'stream', keywords: streamKeyword, locations: streamLocations, users: streamUsers });
		}
	}
}

/*
function requestHome()
{
	socket.emit('home', { type: 'home', data: '' });
}
*/

document.onload = function()
{
}

function toggleAutoScroll(event)
{
	autoScroll = event.checked;
}

function clearOutput()
{
	var element = document.getElementById('outputArea');

	clipOutputText(element, 0, 0);
}

function clipOutputText(element, maxMessages, bufferZone)
{
	var count = (element['innerHTML'].match(/<br>/g)||[]).length;
	var total = maxMessages + bufferZone;

	if(total === 0)
	{
		element.innerHTML = '';
	}
	else if(count > (maxMessages + bufferZone))
	{
		var outputTextRendered = element.innerHTML;

		outputTextRendered = outputTextRendered.split('<br>').splice(count - maxMessages, maxMessages).join('<br>')+'<br>';

		element.innerHTML = outputTextRendered;
	}
}

function appendContent(from, to)
{
	var element;
	while(element = from.firstChild)
	{
		from.removeChild(element);
		to.appendChild(element);
	}
}

function scrollPage()
{
	if(autoScroll == 1)
	window.scrollTo(0, document.body.scrollHeight);
}

function toggleShowEvents(event)
{
	showEvents[event.id] = event.checked;
}

function renderKeywords(messageData)
{
	var re;
	var color;
	var colorInverse;

	streamKeywords.forEach(function(keyword)
	{
		re = new RegExp(keyword, 'i');
		messageData = messageData.replace(re, function(match)
		{
			var color = colorCodeMemoized(match.toLowerCase());
			var invColor = colorCodeInverseMemoized(color);
			return ich.keyword({ keyword: match, keywordColor: color, keywordInverseColor: invColor });
		});
	});

	return messageData;
}

function renderLinks(messageData)
{
	messageData = messageData.replace(/([^\s\(\[\"\>\<\;]|^)[^\s]{3,5}:\/\/([^\s\)\]\<\>]+|$)/g, function(match)
	{
		return ich.link({ url: match });
	});

	return messageData;
}

function trueOrUndefined(thing)
{
	return (thing || (thing === undefined))
}

function updatePage()
{
	var ichData = null;
	var THEData = theData;
	theData = [];
	var streamRendered = [];

	if(THEData.length > 0)
	{
		if(DEBUG.showRenderTime)
		{
			var t1 = new Date();
		}

		for (var i = 0, maxi = THEData.length; i < maxi; i++)
		{
			ichData = null;
			var data = THEData[i]['data'].data;

			switch(THEData[i].type)
			{
				case 'stream':
					ichData = ich.streamTweet(
					{
						location: data.location
						,text: renderKeywords(renderLinks(data.text))
						,image: data.image
						,screen_name: data.screen_name
					});
					ichData = ichData.replace(/[\n\r\t]+/g, ' ').replace(/[\ ]{2,}/g, ' ');
					streamRendered.push(ichData);
				break;

				default:
					//console.log(THEData[i]);
				break;
			}
		}

		var streamOutputArea = document.getElementById('streamOutputArea');
		var newStreamOutput = document.createElement('div');
		newStreamOutput.innerHTML = streamRendered.join('');
		appendContent(newStreamOutput, streamOutputArea);

		if(DEBUG.showRenderTime)
		{
			var t2 = new Date();
			var tdiff = t2 - t1;
			console.log('Render Time: %s ms', tdiff);
		}

		scrollPage();
	}
}

function recieveMessages(data)
{
	var message;
	for(entry in data)
	{
		message = data[entry];

		switch(message.type)
		{
			case 'stream':
				theData.push({ type: 'stream', data: message });
			break;

			default:
				theData.push({ type: 'NotImplemented' });
			break;
		}
	}
}

function colorCode(str)
{
	var r = 128;
	var g = 64;
	var b = 32;

	var front;
	var back;

	if(str)
	{
		for(var i = 0, maxi = str.length; i < maxi; i++)
		{
			front = str.charCodeAt(i);
			back = str.charCodeAt(str.length - 1 - i);
			r = r + (Math.pow(front % 16, 2) + back) * (i * 4) - Math.pow((back + i) % 16, 2);
			g = g + (Math.pow(front % 16, 2) + back) * (i * 3) - Math.pow((back + i) % 16, 2);
			b = b + (Math.pow(front % 16, 2) + back) * (i * 2) - Math.pow((back + i) % 16, 2);
		}
	}

	r = (r >= 0) ? r : -1*r;
	g = (g >= 0) ? g : -1*g;
	b = (b >= 0) ? b : -1*b;

	r = (r + g + 32) % 256;
	g = (g + b + 64) % 256;
	b = (b + r + 128) % 256;

	r = r.toString(16);
	g = g.toString(16);
	b = b.toString(16);

	if(r.length === 1) r = '0'+r;
	if(g.length === 1) g = '0'+g;
	if(b.length === 1) b = '0'+b;

	return ''+r+g+b;
}

function colorCodeInverse(color)
{
	var colorInverse;
	var r;
	var g;
	var b;

	colorInverse = parseInt(color, 16);
	r = 255 - ((colorInverse & 0xff0000) >> 16);
	g = 255 - ((colorInverse & 0x00ff00) >> 8);
	b = 255 - (colorInverse & 0x0000ff);

	r = r.toString(16);
	g = g.toString(16);
	b = b.toString(16);

	if(r.length === 1) r = '0'+r;
	if(g.length === 1) g = '0'+g;
	if(b.length === 1) b = '0'+b;

	return ''+r+g+b;
}

