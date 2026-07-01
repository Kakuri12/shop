const { Readable, Writable } = require("node:stream");
const { handleRequest } = require("../../server.js");

class LambdaResponse extends Writable {
  constructor(resolve, reject) {
    super();
    this.statusCode = 200;
    this.headers = {};
    this.body = [];
    this.headersSent = false;
    this.resolve = resolve;
    this.reject = reject;
  }

  _write(chunk, _encoding, callback) {
    this.body.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    callback();
  }

  setHeader(name, value) {
    this.headers[name.toLowerCase()] = { name, value };
  }

  getHeader(name) {
    return this.headers[name.toLowerCase()]?.value;
  }

  writeHead(statusCode, reasonOrHeaders, maybeHeaders) {
    this.statusCode = statusCode;
    const nextHeaders = typeof reasonOrHeaders === "string" ? maybeHeaders : reasonOrHeaders;
    if (nextHeaders && typeof nextHeaders === "object") {
      for (const [name, value] of Object.entries(nextHeaders)) {
        this.setHeader(name, value);
      }
    }
    this.headersSent = true;
    return this;
  }

  end(chunk, encoding, callback) {
    if (chunk !== undefined && chunk !== null) {
      this.body.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), encoding));
    }
    this.headersSent = true;

    const headers = {};
    const multiValueHeaders = {};
    for (const item of Object.values(this.headers)) {
      if (Array.isArray(item.value)) {
        multiValueHeaders[item.name] = item.value.map(String);
      } else if (item.value !== undefined) {
        headers[item.name] = String(item.value);
      }
    }

    this.resolve({
      statusCode: this.statusCode,
      headers,
      multiValueHeaders,
      body: Buffer.concat(this.body).toString("base64"),
      isBase64Encoded: true,
    });

    if (typeof callback === "function") callback();
    return this;
  }

  destroy(error) {
    if (error) this.reject(error);
    return super.destroy(error);
  }
}

function eventPath(event) {
  if (event.queryStringParameters?.__path) {
    const params = new URLSearchParams(event.queryStringParameters || {});
    const path = params.get("__path") || "/";
    params.delete("__path");
    const query = params.toString();
    return `${path}${query ? `?${query}` : ""}`;
  }

  const headers = lowerCaseHeaders(event.headers || {});
  const originalUrl = headers["x-nf-original-url"] || headers["x-forwarded-uri"] || "";
  if (originalUrl) {
    try {
      const url = new URL(originalUrl, "https://netlify.local");
      return `${url.pathname}${url.search}`;
    } catch {
      return originalUrl;
    }
  }

  const path = event.path || "/";
  const params = new URLSearchParams(event.queryStringParameters || {});
  params.delete("__path");
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}`;
}

function lowerCaseHeaders(headers) {
  return Object.entries(headers).reduce((next, [name, value]) => {
    next[String(name).toLowerCase()] = value;
    return next;
  }, {});
}

function createNodeRequest(event) {
  const headers = lowerCaseHeaders(event.headers || {});
  const body = event.body
    ? Buffer.from(event.body, event.isBase64Encoded ? "base64" : "utf8")
    : null;
  const nodeRequest = body ? Readable.from([body]) : Readable.from([]);

  nodeRequest.method = event.httpMethod || "GET";
  nodeRequest.url = eventPath(event);
  nodeRequest.headers = headers;
  nodeRequest.socket = {
    remoteAddress: headers["x-nf-client-connection-ip"] || headers["x-forwarded-for"] || "",
  };

  if (!nodeRequest.headers.host) nodeRequest.headers.host = headers["x-forwarded-host"] || "shora-hub.netlify.app";
  if (!nodeRequest.headers["x-forwarded-host"]) nodeRequest.headers["x-forwarded-host"] = nodeRequest.headers.host;
  if (!nodeRequest.headers["x-forwarded-proto"]) nodeRequest.headers["x-forwarded-proto"] = "https";

  return nodeRequest;
}

exports.handler = async (event) => {
  const nodeRequest = createNodeRequest(event);
  return await new Promise((resolve, reject) => {
    const nodeResponse = new LambdaResponse(resolve, reject);
    Promise.resolve(handleRequest(nodeRequest, nodeResponse)).catch(reject);
  });
};
