const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/contacts.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

const RAW_OUTPUT_PATH = 'contacts.json';

var resp_page_size = 1000;

var full_person_array = [];

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    // Authorize a client with credentials, then call the Google Tasks API.
    authorize(JSON.parse(content), listConnectionNames);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getNewToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error retrieving access token', err);
            oAuth2Client.setCredentials(token);
            // Store the token to disk for later program executions
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) return console.error(err);
                console.log('Token stored to', TOKEN_PATH);
            });
            callback(oAuth2Client);
        });
    });
}

/**
 * Print the display name if available for 10 connections.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listConnectionNames(auth) {
    const service = google.people({version: 'v1', auth});
    read_contacts(service);
}

function read_contacts(service, nxt_token = null){

    fetch_page_data(service,nxt_token,function(data){
        //console.log(data.connections);
        var connections = data.connections;

        connections.forEach((person) => {
            full_person_array.push(person);
            /*
            if (person.names && person.names.length > 0) {
              var phone_nr = "";
              if(person.phoneNumbers!= undefined){
                phone_nr = person.phoneNumbers[0].value
              }
              console.log("Name: "+person.names[0].displayName+" Phone: "+phone_nr);
            } else {
              console.log('No display name found for connection.');
            }
            */
        });

        nxt_token = data.nextPageToken;
        console.log("Next Page Token: "+nxt_token);

        if(nxt_token != undefined){
            //THIS IS THE LOOP FOR PAGINATION
            read_contacts(service,nxt_token);
        }else{
            //ALL DATA FETCHED NOW IT'S TIME TO WRITE
            write_person_data();
        }
    });
}



function total_items(service,callback){
    service.people.connections.list({
        resourceName: 'people/me',
        pageSize: 1,
        personFields: 'names',
    }, (err, res) => {
        if (err) return console.error('The API returned an error: ' + err);
        const connections = res.data.connections;
        //console.log(res.data);

        if (connections) {
            callback(res.data.totalItems);
        } else {
            console.log('No connections found.');
            callback(0);
        }
    });
}


function fetch_page_data(service, page_token ,callback){

    service.people.connections.list({
        resourceName: 'people/me',
        pageSize: resp_page_size,
        pageToken: page_token,
        personFields: 'names,emailAddresses,phoneNumbers',
    }, (err, res) => {

        if (err) return console.error('The API returned an error: ' + err);

        const connections = res.data.connections;
        next_page_toke = res.data.nextPageToken

        if (connections) {
            callback(res.data);
        } else {
            console.log('No connections found.');
        }

    });
}

function write_person_data(){
    console.log(full_person_array.length);

    fs.writeFile(RAW_OUTPUT_PATH, JSON.stringify(full_person_array), (err) => {
        if (err) console.error(err);
        console.log('DATA stored to', RAW_OUTPUT_PATH);
    });
}