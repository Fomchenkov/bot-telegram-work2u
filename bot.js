const http = require("http");
const fs = require("fs");
const url = require("url");
const path = require("path");
const request = require("request");
const express = require("express");
const telebot = require("telebot");
const config = require("./config");
const admin = require("./admin");

const TOKEN = admin.token;
const bot = new telebot(TOKEN);
// Папка для хранения данных пользователей
const dirForUsers = admin.dirForUsers;
// Папака для хранения данных админа
const ourDir = admin.ourDir;
// Названия файлов
const counterFileName = admin.counterFileName;
const configFileName = admin.configFileName;
const answersFileName = admin.answersFileName;
// Название папки для загрузки файлов для пользователя
const uploadsDirName = admin.uploadsDirName;
const lastMessage = admin.lastMessage;
// Сервер для загрузки данных о пользователях
const serverToUpload = admin.serverToUpload;

/**
* Скачать файл по заданному uri
* @param uri {string} - путь для скачивания файла
* @param filename {string} - название файла на нашем сервере
* @param callback {function} - функция обратного вызова
*/
function download(uri, filename, callback) {
	request.head(uri, (err, res, body) => {
		request(uri).pipe(fs.createWriteStream(filename)).on("close", callback);
	});
}

/**
* Отправить данные польщователя на другой сервер
* @param username {string} - название папки, 
* содержимое которой нужно отправить
*/
function sendUserDataToOtherServer(username) {
	pathToDir = `./${dirForUsers}/${username}/`;
	// Отправить по очереди все содержиоме папки pathToDir
	// (Перекопировать на другой сервер)
}

/**
* Проверка на пройденность опроса
* @return {boolean} - true, если опрос пройден, false - если нет
*/
function checkToEnd(msg) {
	let pathToDir, counter;

	try {
		pathToDir = `./${dirForUsers}/${msg.from.username}/`;
		counter = myRequire(pathToDir + counterFileName);
	} catch(e) {
		// if (e.code !== "ENOENT" || e.code !== "EEXIST") throw e;
		fs.mkdirSync(pathToDir);
		// Создать новые файлы со счетчиком вопросов и с ответами
		let data = JSON.stringify({
			"path": "1",
			"step": "1"
		});
		fs.writeFile(`${pathToDir}/${counterFileName}`, data, (err) => {});
		fs.writeFile(`${pathToDir}/${answersFileName}`, "", (err) => {});
		// Создать папку для загружаемых фотографий
		fs.mkdirSync(`${pathToDir}/${uploadsDirName}`);
		pathToDir = `./${dirForUsers}/${msg.from.username}/`;
		counter = myRequire(pathToDir + counterFileName);
	}

	console.log(counter);
	let currentPath = counter.path;
	let currentStep = counter.step;

	if ((currentStep == 0 ) || (currentPath == 0)) {
		// ОТПРАВИТЬ ДАННЫЕ НА ДРУГОЙ СЕРВЕР
		sendUserDataToOtherServer(msg.from.username);
		bot.sendMessage(msg.from.id, lastMessage);
		return true;
	}
	return false;
}

/**
* Преместиться на один step вперед 
* и занести измененеие в counter файл
* @param msg {object} - 
*/
function plusOneStep(msg) {
	// if (checkToEnd(msg)) return;

	const pathToDir = `./${dirForUsers}/${msg.from.username}/`;
	const counter = myRequire(pathToDir + counterFileName);
	let currentPath = counter.path;
	let currentStep = counter.step;

	if (!config[currentPath-1].data[currentStep]) {
		if (!config[currentPath]) {
			// Все этапы пройдены
			currentPath = 0;
			currentStep = 0;
		} else {
			currentPath++;
			currentStep = 1;
		}
	} else {
		currentStep++;
	}

	console.log("currentPath:", currentPath, "currentStep", currentStep);
	// Занести изменения в файл
	let data = JSON.stringify({
		"path": currentPath,
		"step": currentStep
	});
	fs.writeFileSync(`${pathToDir}/${counterFileName}`, data);
}

/**
* Моя альтернатива методу require()
*/
function myRequire(url) {
	let str = fs.readFileSync(url, "utf8");
	let obj;
	try {
		obj = JSON.parse(str);
	} catch(e) { obj = {"path":1,"step":1}; }
	return obj;
}

/**
* Найти ответ для пользователя
* @param msg {object} ответ telegram сервера
* @return stepObj {object} - объект для отправления сообщения
*/
function findAnswer(msg) {
	// if (checkToEnd(msg)) return;
	// Извлечь информацию о path и step пользователя
	const pathToDir = `./${dirForUsers}/${msg.from.username}/`;
	let counter = myRequire(pathToDir + counterFileName);
	let currentPath = counter.path;
	let currentStep = counter.step;
	let pathname = null;
	// ОТПРАВИТЬ НАЗВАНИЕ НОВОГО ОТДЕЛА
	if (currentStep == 1) {
		pathname = "*" + config[currentPath-1].name + "*";
		pathname += "\n";
		console.log(pathname);
	}
	// Выбрать и отправить сообщение пользователю в соответствии с path и step
	try {
		let result = config[currentPath - 1].data[currentStep - 1];
		if (pathname) {
			result.pathname = pathname;
		}
		return result;
	} catch(e) {}
}

/**
* Отправить сообщение пользователю 
* @param stepObj {object} - объект step из главного json файла
* @param msg {object} - ответ от сервера telegram в виде json
*/
function sendMessage(stepObj, msg) {
	// if (checkToEnd(msg)) return;
	// Проверить, есть ли ответ
	if (! stepObj) {
		console.log("No data to answer");
		return;
	}
	let pathname;
	// Выбрать имеющиеся поля для отправки
	let text = null; // Text message
	let photoUrl = null; // URL to photo
	let markup = null; // Array to build keybrd

	if (stepObj.text) text = stepObj.text;
	if (stepObj.pathname) {
		text = stepObj.pathname + "\n" + text;
	}
	if (stepObj.photoUrl) photoUrl = stepObj.photoUrl;
	if (stepObj.markup) markup = bot.keyboard(stepObj.markup, { resize: true });

	if (text && photoUrl && markup) {
		if (Array.isArray(photoUrl)) {
			bot.sendMessage(msg.from.id, text, { markup, parse: "Markdown" })
			.catch(() => {
				bot.sendMessage(msg.from.id, admin.errorMessage);
			});
			photoUrl.forEach((element, index) => {
				bot.sendPhoto(msg.from.id, element, { markup }).catch(() => {
					bot.sendMessage(msg.from.id, admin.errorMessage);
				});
			});
		} else {
			return bot.sendPhoto(msg.from.id, photoUrl, { 
				caption: text, 
				markup, 
				parse: "Markdown"
			}).catch(() => {
				bot.sendMessage(msg.from.id, admin.errorMessage);
			});
		}
	} else if (text && photoUrl) {
		return bot.sendPhoto(msg.from.id, photoUrl, { caption: text, parse: "Markdown" })
		.catch(() => {
			bot.sendMessage(msg.from.id, admin.errorMessage);
		});
	} else if (text && markup) {
		return bot.sendMessage(msg.from.id, text, { markup, parse: "Markdown" })
		.catch(() => {
			bot.sendMessage(msg.from.id, admin.errorMessage);
		});
	} else if (photoUrl && markup) {
		return bot.sendPhoto(msg.from.id, photoUrl, { markup, parse: "Markdown" })
		.catch(() => {
			bot.sendMessage(msg.from.id, admin.errorMessage);
		});
	} else if (photoUrl) {
		return bot.sendPhoto(msg.from.id, photoUrl, {parse: "Markdown"})
		.catch(() => {
			bot.sendMessage(msg.from.id, admin.errorMessage);
		});
	} else if (text) {
		return bot.sendMessage(msg.from.id, text, {parse: "Markdown"})
		.catch(() => {
			bot.sendMessage(msg.from.id, admin.errorMessage);
		});
	} else {
		text = "Нет ответа. Напишите администратору об этой ошибке.";
		return bot.sendMessage(msg.from.id, text, {parse: "Markdown"})
		.catch(() => {
			bot.sendMessage(msg.from.id, admin.errorMessage);
		});
	}
}

bot.on('/start', msg => {
	console.log(msg);
	// Создать папку и файлы для пользователя, если пользователь новый
	let username = msg.from.username;
	const pathToDir = `./${dirForUsers}/${username}/`;

	try {
		fs.mkdirSync(pathToDir);
		// Создать новые файлы со счетчиком вопросов и с ответами
		let data = JSON.stringify({
			"path": "1",
			"step": "1"
		});
		fs.writeFileSync(`${pathToDir}/${counterFileName}`, data);
		fs.writeFileSync(`${pathToDir}/${answersFileName}`, "");
		// Создать папку для загружаемых фотографий
		fs.mkdirSync(`${pathToDir}/${uploadsDirName}`);
	} catch (e) {
		// Если папка существует => пользвователь уже есть в сиситеме
		if (e.code !== "EEXIST") throw e;
		console.log("Dir is already exists");
	}

	let stepObj = findAnswer(msg);
	console.log(stepObj);
	sendMessage(stepObj, msg);
});

bot.on("/help", msg => {
	let text = "Work2U\nРабота, которой завидуют.";
	return bot.sendMessage(msg.from.id, text);
});

function deleteFolderRecursive(path) {
	var files = [];
	if( fs.existsSync(path) ) {
		files = fs.readdirSync(path);
		files.forEach(function(file,index){
			var curPath = path + "/" + file;
			if(fs.lstatSync(curPath).isDirectory()) { // recurse
				deleteFolderRecursive(curPath);
			} else { // delete file
				fs.unlinkSync(curPath);
			}
		});
		try {
			fs.rmdirSync(path);
		} catch(e) { console.log(e.message); }
	}
}

/**
* Удаление данных о пользователе с сервера 
* и начало нового опроса
*/
bot.on("/restart", msg => {
	// Удалить папку пользователя
	let username = msg.from.username;
	let pathToDir = `./${dirForUsers}/${username}/`;
	deleteFolderRecursive(pathToDir);

	fs.mkdirSync(pathToDir);
	// Создать новые файлы со счетчиком вопросов и с ответами
	let data = JSON.stringify({
		"path": "1",
		"step": "1"
	});
	fs.writeFileSync(`${pathToDir}/${counterFileName}`, data);
	fs.writeFileSync(`${pathToDir}/${answersFileName}`, "");
	// Создать папку для загружаемых фотографий
	fs.mkdirSync(`${pathToDir}/${uploadsDirName}`);

	// Отправить первое сообщение
	let stepObj = findAnswer(msg);
	sendMessage(stepObj, msg);
});

bot.on('text', msg => {
	// Проверять, что введенный текст - не команда
	if (Array.isArray(msg.entities)) {
		if (msg.entities[0].type == "bot_command") {
			return;
		}
	}
	// МОЖНО ПРОВЕРИТЬ, ЕСЛИ НУЖНО ФОТО, А ВВЕДЕН ТЕКСТ

	try {
		fs.mkdirSync(pathToDir);
		// Создать новые файлы со счетчиком вопросов и с ответами
		let data = JSON.stringify({
			"path": "1",
			"step": "1"
		});
		fs.writeFileSync(`${pathToDir}/${counterFileName}`, data);
		fs.writeFileSync(`${pathToDir}/${answersFileName}`, "");
		// Создать папку для загружаемых фотографий
		fs.mkdirSync(`${pathToDir}/${uploadsDirName}`);
	} catch (e) {}

	new Promise((resolve, reject) => {
		if (checkToEnd(msg)) { return; }
		else { resolve(); }
	}).then(() => {
		// Дописать в файл ответ пользователя с указанием номера вопроса
		let username = msg.from.username;
		let pathToDir = `./${dirForUsers}/${username}/`;
		let answersFile = pathToDir + answersFileName;
		let message = msg.text;

		const counter = myRequire(pathToDir + counterFileName);
		// Формирование выходных данных
		text = `<p>${config[counter.path-1].name}<br>`;
		text += `[${config[counter.path-1].data[counter.step-1].text}]<br>`;
		text += `<br><b>${message}</b><br>`;
		text += "-----------------------------------------------------</p>";

		fs.appendFileSync(answersFile, text);
		plusOneStep(msg);
		let stepObj = findAnswer(msg);
		sendMessage(stepObj, msg);
	});
});

bot.on('photo', msg => {
	if (checkToEnd(msg)) return;
	console.log(msg);
	let id = msg.from.id;
	let username = msg.from.username;
	// Найти фото с наибольшим имеющимся разрешением
	let file_id;
	msg.photo.forEach((element, index) => {
		file_id = msg.photo[index].file_id;
	});
	// Сохранить фото на наш сервер
	return bot.getFile(file_id).then(re => {
		console.log(re);
		let file_path = re.file_path;
		let urlToFile = `http://api.telegram.org/file/bot${TOKEN}/${file_path}`;
		console.log("\n", urlToFile, "\n");
		// Имя, под котороым файл сохранится у нас на сервере
		let pathToDir = `./${dirForUsers}/${username}/`;
		let upload = pathToDir + uploadsDirName;
		let parsed = url.parse(urlToFile);
		// let myFileName = upload + path.basename(parsed.pathname);
		let myFileName = upload + myRequire(pathToDir + counterFileName).path;
		myFileName += "." + myRequire(pathToDir + counterFileName).step;
		myFileName += path.extname(parsed.pathname);
		download(urlToFile, myFileName, () => {});
		// Перейти к следующему вопросу
		plusOneStep(msg);
		let stepObj = findAnswer(msg);
		sendMessage(stepObj, msg);
	});
});

// При первом развертывании создаем папку для пользователей
try { fs.mkdirSync("./" + dirForUsers); } 
catch (e) {}

bot.connect();

// Запуск сервера
const server = require("./server");
server.listen((process.env.PORT || 5000), () => console.log("Server started"));
