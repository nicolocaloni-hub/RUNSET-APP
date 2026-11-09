import { createServer } from "node:http";
import geocode from "../api/geocode";
createServer((req, res) => {
  if (req.url?.split("?")[0] !== "/api/geocode") {
    res.statusCode = 404;
    res.end();
    return;
  }
  void geocode(req, res);
}).listen(3001, "127.0.0.1", () =>
  console.log("RunSet API http://127.0.0.1:3001"),
);
