import os
import cloudinary
import cloudinary.uploader
from cloudinary.exceptions import Error as CloudinaryError
from werkzeug.datastructures import FileStorage
import uuid
from typing import Dict, Optional

# Configure Cloudinary
cloudinary.config(
    cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME'),
    api_key=os.getenv('CLOUDINARY_API_KEY'),
    api_secret=os.getenv('CLOUDINARY_API_SECRET'),
    secure=True
)

class CloudinaryService:
    """Service for handling Cloudinary image uploads"""
    
    @staticmethod
    def upload_image(file: FileStorage, folder: str = "krishimitra/products") -> Dict:
        """
        Upload an image to Cloudinary
        
        Args:
            file: The uploaded file
            folder: Cloudinary folder path
            
        Returns:
            Dict with upload result or error
        """
        try:
            # Validate file
            if not file:
                return {"success": False, "error": "No file provided"}
                
            if not file.filename:
                return {"success": False, "error": "No filename provided"}
            
            # Check file type
            allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
            file_ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
            
            if file_ext not in allowed_extensions:
                return {
                    "success": False, 
                    "error": f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
                }
            
            # Generate unique filename
            unique_filename = f"{uuid.uuid4().hex}_{file.filename}"
            
            # Upload to Cloudinary
            upload_result = cloudinary.uploader.upload(
                file,
                folder=folder,
                public_id=unique_filename,
                resource_type="image",
                transformation=[
                    {'width': 800, 'height': 600, 'crop': 'limit'},  # Limit max size
                    {'quality': 'auto:good'},  # Auto optimize quality
                    {'format': 'auto'}  # Auto format selection
                ],
                eager=[
                    {'width': 200, 'height': 150, 'crop': 'thumb'},  # Thumbnail
                    {'width': 400, 'height': 300, 'crop': 'fit'}    # Medium size
                ]
            )
            
            return {
                "success": True,
                "url": upload_result['secure_url'],
                "public_id": upload_result['public_id'],
                "thumbnail_url": upload_result.get('eager', [{}])[0].get('secure_url'),
                "medium_url": upload_result.get('eager', [{}])[1].get('secure_url') if len(upload_result.get('eager', [])) > 1 else None
            }
            
        except CloudinaryError as e:
            return {"success": False, "error": f"Cloudinary error: {str(e)}"}
        except Exception as e:
            return {"success": False, "error": f"Upload failed: {str(e)}"}
    
    @staticmethod
    def delete_image(public_id: str) -> Dict:
        """
        Delete an image from Cloudinary
        
        Args:
            public_id: The Cloudinary public ID of the image
            
        Returns:
            Dict with deletion result
        """
        try:
            result = cloudinary.uploader.destroy(public_id)
            return {"success": True, "result": result}
        except CloudinaryError as e:
            return {"success": False, "error": f"Cloudinary error: {str(e)}"}
        except Exception as e:
            return {"success": False, "error": f"Deletion failed: {str(e)}"}
    
    @staticmethod
    def get_optimized_url(public_id: str, width: int = None, height: int = None, crop: str = "fit") -> str:
        """
        Get an optimized URL for an existing Cloudinary image
        
        Args:
            public_id: The Cloudinary public ID
            width: Target width
            height: Target height
            crop: Crop mode
            
        Returns:
            Optimized image URL
        """
        try:
            transformation = []
            if width or height:
                transform = {"crop": crop}
                if width:
                    transform["width"] = width
                if height:
                    transform["height"] = height
                transformation.append(transform)
            
            transformation.extend([
                {"quality": "auto:good"},
                {"format": "auto"}
            ])
            
            return cloudinary.utils.cloudinary_url(
                public_id,
                transformation=transformation,
                secure=True
            )[0]
        except Exception:
            # Return original URL if transformation fails
            return cloudinary.utils.cloudinary_url(public_id, secure=True)[0]