import { fileURLToPath } from "url";
import { ALARM, PROXIES, PROXY_LIST, OPEN_URL, USER_AGENTS } from '../main.js'
import threeBeeps from "../utils/notification/beep.js"
import sendAlerts from "../utils/notification/alerts.js"
import writeErrorToFile from "../utils/writeToFile.js"
import open from "open"
import axios from "axios";
import moment from "moment"
import DomParser from "dom-parser";     // https://www.npmjs.com/package/dom-parser
import HttpsProxyAgent from 'https-proxy-agent'


if (process.argv[1] === fileURLToPath(import.meta.url)) {
    let interval = {
        unit: 'seconds',    // seconds, m: minutes, h: hours
        value: 5           
    }
	let url = 'https://www.currys.co.uk/gbuk/gaming/console-gaming/controllers/microsoft-xbox-wireless-controller-robot-white-10211569-pdt.html'
    currys(url, interval);
}


const store = 'Currys'
let firstRun = new Set();
let urlOpened = false;
export default async function currys(url, interval) {
    let res = null, html = null, proxy = null

    try {
        let options = null

        // Setup proxies
        if (PROXIES && PROXY_LIST.length > 0) {
            proxy = 'http://' + PROXY_LIST[Math.floor(Math.random() * PROXY_LIST.length)];
            let agent = new HttpsProxyAgent(proxy);
            options = {
                httpsAgent: agent,
                headers: {
                    'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
                }
            }
        }
        else options = { headers: { 'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)] } }


        // Get Page
        res = await axios.get(url, options)
            .catch(async function (error) {
                writeErrorToFile(store, error);
            });


        // Extract Information
        if (res && res.status == 200) {
            html = res.data

            let parser = new DomParser();
            let doc = parser.parseFromString(html, 'text/html');
			let title = doc.getElementsByClassName('product_name')
			let inventory = doc.getElementsByClassName('space-b center')
            let image = doc.getElementsByTagName('meta').filter(meta => meta.getAttribute('property') == 'og:image')
            
            if (title.length > 0) title = title[0].textContent
			if (inventory.length > 0) {
				inventory = inventory[0].getAttribute('data-button-label')
				if (inventory.length > 0) inventory = inventory.slice(29, 42)
            }
            if (image.length > 0) image = image[0].getAttribute('content')

            if (inventory != 'Add to basket' && !firstRun.has(url)) {
                console.info(moment().format('LTS') + ': "' + title + '" not in stock at ' + store + '.' + ' Will keep retrying in background every', interval.value, interval.unit)
                firstRun.add(url)
            }
			else if (inventory == 'Add to basket') {
                if (ALARM) threeBeeps();
                if (OPEN_URL && !urlOpened) { 
                    open(url); 
                    sendAlerts(url, title, image, store)
                    urlOpened = true; 
                    setTimeout(() => urlOpened = false, 1000 * 295) // Open URL and post to webhook every 5 minutes
                }
                console.info(moment().format('LTS') + ': ***** In Stock at ' + store + ' *****: ', title);
                console.info(url);
            }
        }

    } catch (e) {
        writeErrorToFile(store, e, html, res.status)
    }
};
