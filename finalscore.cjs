//install nodeJS
//install the following libraries using npm: request, request-promise, moment, simple-oauth2, convert-array-to-csv
//create an application on the 42 intranet under settings
//add your api credentials and piscine details below
//run this script by navigating to the script folder and entering the command: node finalscore

const fs = require('fs');
const request = require("request-promise");
const moment = require('moment');
const { ClientCredentials } = require('simple-oauth2');
const { convertArrayToCSV } = require('convert-array-to-csv');

//change date for every day format: ddmmyy-hhmm
const daytime = '160721-0830';

const domain = 'https://api.intra.42.fr';

//Add your applicant UID and SECRET HERE
const UID = "6dc9d8d00dd5d09aba1bc3cb68b33a07ee98173a2a889290a3a43b71ccf1cc17";
const SECRET = "9daec542a7601f55e8d5c66d3fa28ef808831e5c1845b369f580709e6ac94094";

//Add your piscine details here
const campus_id = 36;
const piscine_month = "august";
const piscine_year = "2021";

const projects = [
	{id: 1255, name: "C Piscine Shell 00", short: "S00"},
	{id: 1256, name: "C Piscine Shell 01", short: "S01"},
	{id: 1257, name: "C Piscine C 00", short: "C00"},
	{id: 1258, name: "C Piscine C 01", short: "C01"},
	{id: 1259, name: "C Piscine C 02", short: "C02"},
	{id: 1260, name: "C Piscine C 03", short: "C03"},
	{id: 1261, name: "C Piscine C 04", short: "C04"},
	{id: 1262, name: "C Piscine C 05", short: "C05"},
	{id: 1263, name: "C Piscine C 06", short: "C06"},
	{id: 1270, name: "C Piscine C 07", short: "C07"},
	{id: 1264, name: "C Piscine C 08", short: "C08"},
	{id: 1265, name: "C Piscine C 09", short: "C09"},
	{id: 1266, name: "C Piscine C 10", short: "C10"},
	{id: 1267, name: "C Piscine C 11", short: "C11"},
	{id: 1268, name: "C Piscine C 12", short: "C12"},
	{id: 1271, name: "C Piscine C 13", short: "C13"},
	{id: 1308, name: "C Piscine Rush 00", short: "R00"},
	{id: 1310, name: "C Piscine Rush 01", short: "R01"},
	{id: 1309, name: "C Piscine Rush 02", short: "R02"},
	{id: 1305, name: "C Piscine BSQ", short: "BSQ"},
	{id: 1301, name: "C Piscine Exam 00", short: "E00"},
	{id: 1302, name: "C Piscine Exam 01", short: "E01"},
	{id: 1303, name: "C Piscine Exam 02", short: "E02"},
	{id: 1304, name: "C Piscine Final Exam", short: "FE"},
]

const feedback = [
	{name: "F0", rating: 0},
	{name: "F1", rating: 1},
	{name: "F2", rating: 2},
	{name: "F3", rating: 3},
	{name: "F4", rating: 4},
	{name: "F5", rating: 5},
]

let data = [];
let token = null;
let studentTries = new Map();

const config = {
  client: {
    id: UID,
    secret: SECRET
  },
  auth: {
    tokenHost: domain
  }
};

function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getToken(){
  const oauth2 = new ClientCredentials(config);
  const tokenConfig = {
    scope: ['public', 'projects'],
  };
 
  try {
    const result = await oauth2.getToken(tokenConfig);
    return result.token.access_token;  
  } catch (error) {
    console.log('Access Token error', error.message);
  }
}

async function queryAllData(method, url, params = {}, full = false){

  let page = 0;
  let result = null
  let results = [];

  while(!result || result.length == 100){
    try{
      params.page = {size: 100, number: page};
      result = await queryData(method, url, params, full);
      console.log(url, page, result.length)
      results = results.concat(result);
      page++
      await timeout(400);
    }catch(err){
      console.log(err);
      // retry = true;
    }
  }

  return results;
}

async function queryData(method, url, params = {}, full = false, headers = {}){
  try{
    const req = await request({
      method: method,
      url: url,
      auth: {
        'bearer': token
      },
      json: true,
      body: params,
      resolveWithFullResponse: full,
      headers: headers,
    })
    return req;
  }catch (err){
    console.log(err.message)
  } 
}

async function getProjectData(students){
	data[0].push(...projects.map(a => a.short), "FE PRESENT");
	const projectData = await queryAllData("get", `${domain}/v2/projects_users/`, {filter:{user_id:students.map(a => a.id)}, page:{number: 0, size:100}});

	for (const [i, student] of students.entries()) {
		const studentProjects = [];
		const studentProjectData = projectData.filter(a => a.user.id == student.id);
		let tries = 0;

		for (const project of projects) {
			const projectMatch = studentProjectData.find(a => a.project.id == project.id);
			
			if(projectMatch){
				studentProjects.push(projectMatch.final_mark || 0);
				if(project.short == "FE") studentProjects.push(1);
				tries = tries + (projectMatch.occurrence + 1);
			}else{
				studentProjects.push(0) 
				if(project.short == "FE") studentProjects.push(0);
			}
			studentTries.set(student.id, tries);
		}
		
		data[i+1].push(...studentProjects)
	}
}

async function getFeedbackData(students){

	data[0].push(...feedback.map(a => a.name));
	const feedbackData = await queryAllData("get", `${domain}/v2/feedbacks/`, {filter:{user_id:studentIDs}, feedbackable_type:"ScaleTeam", page:{number: 0, size:100}});

	for (const [i, student] of students.entries()) {
		const studentFeedback = [0,0,0,0,0,0];
		const studentFeedbackData = feedbackData.filter(a => a.user.id == student.id)

		for (const feedback of studentFeedbackData) {
			studentFeedback[feedback.rating] += 1;
		}
		
		data[i+1].push(...studentFeedback)
	}
}

async function getTimeData(students){

	data[0].push("minutes");
	const timeData = await queryAllData("get", `${domain}/v2/locations/`, {filter:{user_id:students.map(a => a.id)}, page:{number: 0, size:100}});
	for (const [i, student] of students.entries()) {
		let studentTime = 0;
		const studentTimeData = timeData.filter(a => a.user.id == student.id)

		for (const time of studentTimeData) {
			const minutes = moment(time.end_at).diff(moment(time.begin_at), "minutes");
			if (!Number.isNaN(minutes)) {
				studentTime += minutes;
			}
		}
		
		data[i+1].push(studentTime)
	}
}

async function getLevel(students){

	data[0].push("level");

  const cursusInfo = await queryAllData("get", `${domain}/v2/cursus_users/`, {filter:{user_id:students.map(a => a.id)}, page:{number: 0, size:100}});


	for (const [i, student] of students.entries()) {
		let skillLevel = 0;
			
		const cursus = cursusInfo.filter(a => a.user.id == student.id);

		for(const course of cursus){
			if(course.cursus.id == 9){
				skillLevel = course.level;
				break;
			}
		}

   		data[i+1].push(skillLevel);
	}
}

function addTries(students){
	data[0].push("tries");
  
	for (const [i, student] of students.entries()) {
	  
	  data[i+1].push(studentTries.get(student.id));
  
	}
}

async function run(){

	try{
		token = await getToken();
			
		let students = await queryAllData("get", `${domain}/v2/campus/${campus_id}/users`, {filter:{kind:"student", pool_year: piscine_year, pool_month: piscine_month}});
		students = students.filter((entry, index, self) => self.findIndex(a => a.id === entry.id) === index);
		students = students.filter(student => student.login.indexOf("test") == -1);

		studentIDs = students.map(a => a.id);

		data.push(["login"]);

		for (const student of students) {
			data.push([student.login])
		}

		await getProjectData(students);
		await getFeedbackData(students);
		await getTimeData(students);
		await getLevel(students);		
		addTries(students);

		//writeFile(convertArrayToCSV(data), `csv/finalscore_${month}.csv`)
		writeFile(convertArrayToCSV(data), `csv/finalscore_${daytime}.csv`)
	
	}catch(error){  
		console.log(error)
	}
}

run();


/////////


function writeFile(data, filename, json=false){
  if(json) data = JSON.stringify(data);
  fs.writeFile(filename, data, (err) => {
    if (err) throw err;
    console.log('The file has been saved!');
  });
}