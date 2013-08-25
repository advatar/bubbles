# Bubbles

Until a true OAuth2 flow has been implemented you would have to specify a username and password in the config.json file.

config.json

{	"uaa" : "http://uaa.run.pivotal.io",
	"api":  "http://api.run.pivotal.io",
	"username": "johan@sellstrom.me",
	"password": "*****"
}

#local

export CONFIG=`cat config.json


#cloudfoundry

cf set-env myapp CONFIG `cat config.json`