require('dotenv').config();
const axios = require('axios');
const md5 = require('md5');

class XRay {
    constructor() {
        this._axios = axios;
        this._md5 = md5;
        this._host = 'http://88.210.3.140:5056';
        this._login = process.env.XRAY_LOGIN;
        this._password = process.env.XRAY_PASSWORD;
    }

    async getUsersList(cookies) {
        const url = `${this._host}/testpath/panel/inbound/list`;
        const headers = {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'ru-RU,ru;q=0.9',
            'X-KL-Ajax-Request': 'Ajax_Request',
            'X-Requested-With': 'XMLHttpRequest',
            'Cookie': cookies
        };
        let clients = [];
        try {
            const response = await this._axios.post(url, {}, { headers });
            if (response.status === 200) {
                for (let ietm of response.data.obj) {
                    if (ietm.id == 2) {
                        const settings = JSON.parse(ietm.settings);
                        clients = settings.clients;
                    }
                }
            } else {
                console.error(`Failed to get server status with status code ${response.status}:`, response.data);
            }
            return clients;
        } catch (error) {
            if (error.response) {
                console.error("Error response data:", error.response.data);
                console.error("Error response headers:", error.response.headers);
                console.error("Error response status:", error.response.status);
            } else {
                console.error("Error fetching server status:", error.message);
            }
        }
    }

    async addUser(cookies, userData) {
        const url = `${this._host}/testpath/panel/inbound/addClient`;
        const headers = {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'ru-RU,ru;q=0.9',
            'X-KL-Ajax-Request': 'Ajax_Request',
            'X-Requested-With': 'XMLHttpRequest',
            'Cookie': cookies
        };
        const userName = userData.username && userData.username != '' ? userData.username : userData.user_tg_id;
        const subId = 'sub_id_' + userData.user_tg_id;
        const clientId = this._md5(userData.user_tg_id);
        const data = {
            id: 2,
            settings: JSON.stringify({
                clients: [{
                    id: clientId,
                    flow: '',
                    email: userName,
                    limitIp: 0,
                    totalGB: 0,
                    expiryTime: 0,
                    enable: true,
                    tgId: userData.user_tg_id,
                    subId: subId,
                    reset: 0
                }]
            })
        };
        try {
            const response = await this._axios.post(url, data, { headers });
            if (response.status === 200) {
                console.log("User added successfully:", response.data);
                return true;
            } else {
                console.error(`Failed to add user with status code ${response.status}:`, response.data);
                return false;
            }
        } catch (error) {
            console.error("Error adding user:", error.message);
        }
    }

    async deleteUser(cookies, clientId) {
        const url = `${this._host}/testpath/panel/inbound/2/delClient/${clientId}`;
        const headers = {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'ru-RU,ru;q=0.9',
            'X-KL-Ajax-Request': 'Ajax_Request',
            'X-Requested-With': 'XMLHttpRequest',
            'Cookie': cookies
        };
        try {
            const response = await this._axios.post(url, {}, { headers });
            if (response.status === 200) {
                console.log("User deleted successfully:", response.data);
                return true;
            } else {
                console.error(`Failed to delete user with status code ${response.status}:`, response.data);
                return false;
            }
        } catch (error) {
            console.error("Error deleting user:", error.message);
        }
    }

    async loginUser() {
        const url = `${this._host}/testpath/login`;
        const headers = {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'ru-RU,ru;q=0.9',
            'X-KL-Ajax-Request': 'Ajax_Request',
            'X-Requested-With': 'XMLHttpRequest'
        };
        const data = new URLSearchParams({
            username: this._login,
            password: this._password
        });
        try {
            const response = await this._axios.post(url, data, { headers, withCredentials: true });
            if (response.status === 200) {
                return response.headers['set-cookie'][1];
            } else {
                console.error(`Login failed with status code ${response.status}:`, response.data);
                return null;
            }
        } catch (error) {
            console.error("Error during login:", error.message);
            return null;
        }
    }

    async getServerStatus(cookies) {
        const url = `${this._host}/testpath/server/status`;
        const headers = {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'ru-RU,ru;q=0.9',
            'X-KL-Ajax-Request': 'Ajax_Request',
            'X-Requested-With': 'XMLHttpRequest',
            'Cookie': cookies
        };
        try {
            const response = await this._axios.post(url, {}, { headers });
            if (response.status === 200) {
                console.log("Server status:", response.data);
            } else {
                console.error(`Failed to get server status with status code ${response.status}:`, response.data);
            }
        } catch (error) {
            if (error.response) {
                console.error("Error response data:", error.response.data);
                console.error("Error response headers:", error.response.headers);
                console.error("Error response status:", error.response.status);
            } else {
                console.error("Error fetching server status:", error.message);
            }
        }
    }
}

module.exports = { XRay }
