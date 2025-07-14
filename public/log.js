
export function log(message) {
  const timestamp = new Date().toISOString();
  const fullMessage = `[${timestamp}] ${message}`;
  console.log(fullMessage);

  // Также записываем в лог-файл через API, если потребуется
  try {
    fetch("/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ log: fullMessage })
    });
  } catch (e) {
    console.error("Ошибка логирования", e);
  }
}
