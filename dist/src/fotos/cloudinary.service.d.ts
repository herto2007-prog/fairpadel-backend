export declare class CloudinaryService {
    private readonly cloudName;
    private readonly apiKey;
    private readonly apiSecret;
    uploadImage(base64Image: string): Promise<any>;
    deleteImage(imageUrl: string): Promise<void>;
    uploadVideo(base64Video: string): Promise<any>;
}
