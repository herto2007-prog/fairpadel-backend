"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudinaryService = void 0;
const common_1 = require("@nestjs/common");
let CloudinaryService = class CloudinaryService {
    constructor() {
        this.cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        this.apiKey = process.env.CLOUDINARY_API_KEY;
        this.apiSecret = process.env.CLOUDINARY_API_SECRET;
    }
    async uploadImage(base64Image) {
        const timestamp = Date.now();
        const fakeUrl = `https://res.cloudinary.com/${this.cloudName}/image/upload/v${timestamp}/fairpadel/foto_${timestamp}.jpg`;
        const fakeThumbnail = `https://res.cloudinary.com/${this.cloudName}/image/upload/c_thumb,w_200,h_200/v${timestamp}/fairpadel/foto_${timestamp}.jpg`;
        return {
            url: fakeUrl,
            thumbnail: fakeThumbnail,
            publicId: `fairpadel/foto_${timestamp}`,
        };
    }
    async deleteImage(imageUrl) {
        console.log('Eliminando imagen:', imageUrl);
    }
    async uploadVideo(base64Video) {
        const timestamp = Date.now();
        return {
            url: `https://res.cloudinary.com/${this.cloudName}/video/upload/v${timestamp}/fairpadel/video_${timestamp}.mp4`,
            thumbnail: `https://res.cloudinary.com/${this.cloudName}/video/upload/v${timestamp}/fairpadel/video_${timestamp}.jpg`,
            publicId: `fairpadel/video_${timestamp}`,
        };
    }
};
exports.CloudinaryService = CloudinaryService;
exports.CloudinaryService = CloudinaryService = __decorate([
    (0, common_1.Injectable)()
], CloudinaryService);
//# sourceMappingURL=cloudinary.service.js.map