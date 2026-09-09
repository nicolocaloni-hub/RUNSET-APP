import { createServer } from "node:http";
import handler from "../api/runset";
createServer((req, res) => {
  if (req.url?.split("?")[0] !== "/api/runset") {
    res.statusCode = 404;
    res.end();
    return;
  }
  void handler(req, res);
}).listen(3001, "127.0.0.1", () =>
  console.log("RunSet API http://127.0.0.1:3001"),
);
