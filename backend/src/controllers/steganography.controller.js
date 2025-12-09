import { encodeMessage, decodeMessage } from '../services/steganography.service.js';

class SteganographyController {
    async encodeImage(req, res) {
        try {
            if (!req.file) {
                throw new Error('Please upload an image');
            }
            const message = req.body.message;
            if (!message) {
                throw new Error('Please provide a message to encode');
            }

            const result = await encodeMessage(req.file.path, message);
            res.status(200).json({ 
                success: true, 
                data: result 
            });
        } catch (error) {
            res.status(500).json({ error: 'Error encoding image' });
        }
    }

    async decodeImage(req, res) {
        try {
            if (!req.file) {
                throw new Error('Please upload an image');
            }

            const message = await decodeMessage(req.file.path);
            res.status(200).json({ 
                success: true, 
                message 
            });
        } catch (error) {
            res.status(500).json({ error: 'Error decoding image' });
        }
    }
}

export default new SteganographyController();