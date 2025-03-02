const WebSocket = require('ws');
const fetch = require('node-fetch').default;
const { XMLParser } = require('fast-xml-parser');

const wss = new WebSocket.Server({ port: 8080 });
const trackedLinks = [];

wss.on('connection', (ws) => {
  console.log('Wtyczka podłączona');
  ws.send(JSON.stringify({ links: trackedLinks }));
});

async function fetchRSS(url) {
  try {
    const response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Błąd HTTP: ${response.status} - ${response.statusText}. Odpowiedź: ${errorText.slice(0, 200)}`);
    }
    const text = await response.text();
    console.log(`Surowa odpowiedź RSS (${url}):`, text.slice(0, 500)); // Logowanie pierwszych 500 znaków
    const parser = new XMLParser({ ignoreAttributes: false });
    const json = parser.parse(text);
    if (!json.rss || !json.rss.channel || !json.rss.channel.item) {
      throw new Error('Nieprawidłowa struktura RSS: brak rss.channel.item');
    }
    return json.rss.channel.item.map(item => item.link);
  } catch (error) {
    console.error(`Błąd pobierania RSS (${url}):`, error.message);
    return []; // Zwracamy pustą tablicę w przypadku błędu
  }
}

async function trackSources() {
  try {
    // Statyczna lista linków X (tymczasowo, dopóki nie znajdziemy działającego RSS)
    const xLinks = [
      'https://x.com/elonmusk/status/1896108100220043618', // Przykład z Twoich logów
      'https://x.com/elonmusk/status/1895901234567890123', // Fikcyjny przykład
      'https://x.com/elonmusk/status/1895709876543210987'  // Fikcyjny przykład
    ];
    xLinks.forEach(link => {
      if (!trackedLinks.includes(link) && trackedLinks.length < 10) {
        trackedLinks.push(link);
        console.log('Dodano link z X:', link);
      }
    });

    // Śledzenie NYT (poprawny URL RSS)
    const nytLinks = await fetchRSS('https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml');
    nytLinks.forEach(link => {
      if (!trackedLinks.includes(link) && trackedLinks.length < 10) {
        trackedLinks.push(link);
        console.log('Dodano link z NYT:', link);
      }
    });

    // Wysyłanie do wszystkich klientów
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ links: trackedLinks }));
      }
    });
  } catch (error) {
    console.error('Błąd śledzenia:', error);
  }
}

// Śledzenie co 30 sekund
setInterval(trackSources, 30000);
trackSources(); // Start natychmiastowy