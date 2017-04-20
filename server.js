const fs = require("fs");
const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const admin = require("./admin");

const app = express();
const dirForUsers = admin.dirForUsers;
// Ссылка для просмотра базы данных с сайта
const databaseName = admin.databaseNameToSite;

// Публичная папка
app.use("/" + dirForUsers, express.static(dirForUsers));
app.use(cookieParser());

/**
* Проверяет авторизирован ли пользователь
* @param req {object} - объект запроса пользователя
* @return {boolean} - true, если авторизирован; false, если нет
*/
function isOuth(req) {
	if (req.cookies.login == admin.siteLogin 
		&& req.cookies.password == admin.sitePassword) {
		return true;
	}
	return false;
}

/**
* Проверяет, папка это или нет
* @param path {string} - файл или папка
* @return {boolean} - true, если папка; false - если файл
*/
function isDir(path) {
	return fs.lstatSync(path).isDirectory();
}

app.get('/', (req, res) => {
	res.send("<p>Telegram bot working...</p>");
});

// Страница авторизации
app.get(`/${admin.databaseNameToLogin}`, (req, res) => {
	let html = "";
	// Форма для авторизации
	let form = `<form action="/${admin.databaseNameToLogin}" method="GET">
					<p>Логин<br>
					<input type="text" name="login"></p>
					<p>Пароль<br>
					<input type="text" name="password"></p>
					<p><input type="submit" name="Войти"></p>
				</form>`;

	// Если пользователь уже авторизирован
	if (isOuth(req)) {
		// Перенаправить пользователя на database
		res.redirect(`/${databaseName}`);
		return;
	// Проверить, переданы ли данные формы
	} else if (req.query.login && req.query.password) {
		// При успешной регистрации
		if (req.query.login == admin.siteLogin 
			&& req.query.password == admin.sitePassword) {
			// Назначение куков login и password
			res.cookie("login", req.query.login);
			res.cookie("password", req.query.password);
			html += `Вы выполнили вход!<p><a href="/${databaseName}">Перейти к базе данных</a><p>`;
			res.send(html);
			return;
		} else {
			// При неуспешной регистрации
			html += "<p>Неверный логин или пароль</p>";
			html += form;
			res.send(html);
			return;
		}		
	} else {
		// Отправить форму для авторизации
		html += form;
		res.send(html);
	}
});

// Страница для выхода с сайта
app.get(`/${admin.databaseNameToLogout}`, (req, res) => {
	res.clearCookie('login');
	res.clearCookie('password');
	res.redirect(`/${admin.databaseNameToLogin}`);
	return;
});

// Обращение к базе данных с пользователями
app.get(`/${databaseName}`, (req, res) => {
	// Проверить авторизацию
	if (! isOuth(req)) {
		res.send(`Доступ запрещен.<p><a href="/${admin.databaseNameToLogin}">Выполните вход</a><p>`);
		return;
	}

	// Путь в базе данных
	let route = req.query.route;
	// Ответ от сервера
	let exitLink = `<p><a href="/${admin.databaseNameToLogout}">Выйти</a></p>`;
	let html = ""; // exitLink;

	// Если route передан
	if (route) {
		// Вывести содержимое папки запрошенного пользователем
		if (isDir(route)) {
			fs.readdir(route, (err, files) => {
				console.log(files);

				for (let i = 0; i < files.length; i++) {
					let file = route + "/" + files[i];
					if (files[i] == admin.counterFileName) continue;
					console.log(file);
					if (isDir(file)) {
						html += `<p>Папка <a href="${databaseName}?route=${file}">${files[i]}</a></p>`;
					} else {
						html += `<p>Файл <a target="_blank" href="${databaseName}?route=${file}"">${files[i]}</a></p>`;
					}
				}

				if (html == "" || html == exitLink) html = "<p>Папка пуста</p>";
				html += `<p><a href="${databaseName}">На главную</a></p>`;
				res.send(html);
			});
		} else {
			// НУЖНО ПРОВЕРИТЬ, ТЕКСТ ИЛИ КАРТИНКА!!!
			let picExt = {
				gif: "gif", jpg: "jpg", jpeg: "jpeg", png: "png"
			}

			// Если файл - картинка
			let type = picExt[path.extname(route).slice(1)];
			console.log(type);

			if (picExt[path.extname(route).slice(1)]) {
				html += `<img src="${route}">`;
				html += `<p><a href="${databaseName}">На главную</a></p>`;
				res.send(html);
			} else {
				// Вывести файл тестовый файл
				fs.readFile(route, "utf8", (err, data) => {
					html += `<p>${data}</p>`;
					html += `<p><a href="${databaseName}">На главную</a></p>`;
					res.send(html);
				});
			}
		}
	} else {
		// Вывести содержимое корневой папки базы данных
		route = dirForUsers + "/";

		fs.readdir(route, (err, files) => {
			console.log(files);

			for (let i = 0; i < files.length; i++) {
				let file = route + files[i];
				if (isDir(file)) {
					html += `<p>Папка <a href="${databaseName}?route=${file}">${files[i]}</a></p>`;
				} else {
					html += `<p>Файл <a href="${databaseName}?route=${file}"">${files[i]}</a></p>`;
				}
			}

			if (html == "" || html == exitLink) html += "<p>Папка пуста</p>";
			html += `<p><a href="${databaseName}">На главную</a></p>`;
			res.send(html);			
		});
	}
});

module.exports = app;
