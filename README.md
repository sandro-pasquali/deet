# deet

Middleware enabling validation of JSON payloads sent to [Express]( https://github.com/visionmedia/express ) API endpoints against JSON Schemas, XSS scripting protections, and more.

## Why validate with JSON schemas?

- **Simple** - JSON schemas are a simple and expressive, [standard](http://json-schema.org/) way to describe the data that your API expects to receive.
- **Standard** - That part where you have to design and implement a payload description and validation model? Already done.
- **Safe** - Your application never sees payloads that fail to validate. Failures are isolated and self-managing, external to your application logic. Can also help with XSS and other spoofing attacks.
- **Expressive** - Validation errors precisely identify the location and type of error, with the validation rules open and accessible.
- **Expressive** - Creating a JSON Schema documents API requirements.
- **Expressive** - JSON Schemas extend JSON syntax, providing a powerful and well understood data-interchange format for distributed applications.

## Installation

```
npm install deet
```

## Testing

```
npm test

For much more expressive debugging/testing it is recommended you run:

DEBUG=* npm test
```

## About JSON schemas

- [Understanding JSON Schema](http://spacetelescope.github.io/understanding-json-schema/)



