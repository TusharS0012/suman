# Steganography Backend

This project is a backend application for steganography, which allows encoding and decoding messages within images. It is built using Node.js and Express.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Contributing](#contributing)
- [License](#license)

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   ```

2. Navigate to the project directory:
   ```
   cd steganography-backend
   ```

3. Install the dependencies:
   ```
   npm install
   ```

4. Create a `.env` file in the root directory and add your environment variables.

## Usage

To start the application, run:
```
npm start
```

The server will start on the specified port in your `.env` file.

## API Endpoints

- `POST /steganography/encode`: Encode a message into an image.
- `POST /steganography/decode`: Decode a message from an image.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

This project is licensed under the MIT License.