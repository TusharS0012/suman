import png from "/png.png";
import pdf from "/pdf.png";
import jpg from "/jpg.png";
import image from "/image.png";
import bmp from "/bmp.png";
import webp from "/WebP.png";
import gif from "/gif.gif";
import avif from "/avif.png";

export const Converter_List = [
    {
        logo: jpg,
        title: "LSB",
        info: "Use the LSB Steganography algorithm",
        targetFormat: "jpg",
        sourceFormat: "image",
        acceptedFormats: ["png", "bmp", "gif", "webp", "avif", "tiff"],
        endpoint: "img-convert",
    },
    {
        logo: jpg,
        title: "DCT",
        info: "Use the DCT Steganography algorithm",
        targetFormat: "jpg",
        sourceFormat: "image",
        acceptedFormats: ["png", "bmp", "gif", "webp", "avif", "tiff"],
        endpoint: "img-convert",
    },
    {
        logo: jpg,
        title: "DWT",
        info: "Use the DWT Steganography algorithm",
        targetFormat: "jpg",
        sourceFormat: "image",
        acceptedFormats: ["png", "bmp", "gif", "webp", "avif", "tiff"],
        endpoint: "img-convert",
    },
    {
        logo: jpg,
        title: "PVD",
        info: "Use the PVD Steganography algorithm",
        targetFormat: "jpg",
        sourceFormat: "image",
        acceptedFormats: ["png", "bmp", "gif", "webp", "avif", "tiff"],
        endpoint: "img-convert",
    },
    {
        logo: jpg,
        title: "msHEdgeGrayFT1",
        info: "Use the msHEdgeGrayFT1 fuzzy edge LSB steganography algorithm",
        targetFormat: "jpg",
        sourceFormat: "image",
        acceptedFormats: ["png", "bmp", "gif", "webp", "avif", "tiff"],
        endpoint: "img-convert",
        // if your frontend uses a key to choose backend route, you can also add:
        // algoKey: "mshedgegrayft1"
    },
];

export const MIME_TYPES = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    bmp: "image/bmp",
    gif: "image/gif",
    webp: "image/webp",
    avif: "image/avif",
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
};
