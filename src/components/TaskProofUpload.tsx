import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, Upload, Star, Loader2, Image as ImageIcon, X } from "lucide-react";

interface TaskProof {
  id: string;
  image_url: string;
  ai_rating: number;
  ai_feedback: string;
  created_at: string;
}

interface TaskProofUploadProps {
  taskId: string;
  taskTitle: string;
  taskDescription?: string | null;
  proofs: TaskProof[];
  onProofAdded: () => void;
}

const TaskProofUpload = ({ taskId, taskTitle, taskDescription, proofs, onProofAdded }: TaskProofUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUploadAndValidate = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please log in first");
        return;
      }

      // Upload to storage
      const fileExt = selectedFile.name.split(".").pop();
      const filePath = `${user.id}/${taskId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("proof-images")
        .upload(filePath, selectedFile);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        toast.error("Failed to upload image");
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("proof-images")
        .getPublicUrl(filePath);

      // Call AI validation
      const { data, error } = await supabase.functions.invoke("validate-task-proof", {
        body: {
          task_id: taskId,
          image_url: publicUrl,
          task_title: taskTitle,
          task_description: taskDescription,
        },
      });

      if (error) {
        console.error("Validation error:", error);
        toast.error("Failed to validate proof");
        return;
      }

      const ratingEmoji = data.rating >= 8 ? "🌟" : data.rating >= 5 ? "👍" : "🔄";
      toast.success(`${ratingEmoji} AI Rating: ${data.rating}/10`);
      
      setSelectedFile(null);
      setPreviewUrl(null);
      onProofAdded();
    } catch (err) {
      console.error("Error:", err);
      toast.error("Something went wrong");
    } finally {
      setIsUploading(false);
    }
  };

  const cancelPreview = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const ratingColor = (rating: number) => {
    if (rating >= 8) return "bg-success text-success-foreground";
    if (rating >= 5) return "bg-warning text-warning-foreground";
    return "bg-destructive text-destructive-foreground";
  };

  return (
    <div className="space-y-3">
      {/* Upload area */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {!previewUrl ? (
        <Button
          variant="outline"
          className="w-full rounded-xl border-dashed border-2 h-auto py-4"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <div className="flex flex-col items-center gap-1.5">
            <Camera className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Upload proof photo</span>
          </div>
        </Button>
      ) : (
        <div className="space-y-2">
          <div className="relative rounded-xl overflow-hidden border">
            <img src={previewUrl} alt="Proof preview" className="w-full max-h-48 object-cover" />
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7 rounded-full"
              onClick={cancelPreview}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Button
            className="w-full rounded-xl"
            onClick={handleUploadAndValidate}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                AI is validating...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Submit for AI Validation
              </>
            )}
          </Button>
        </div>
      )}

      {/* Previous proofs */}
      {proofs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Previous Proofs</p>
          {proofs.map((proof) => (
            <Card key={proof.id} className="rounded-xl border-0 shadow-sm">
              <CardContent className="p-3">
                <div className="flex gap-3">
                  <img
                    src={proof.image_url}
                    alt="Proof"
                    className="w-16 h-16 rounded-lg object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`text-xs ${ratingColor(proof.ai_rating)}`}>
                        <Star className="h-3 w-3 mr-0.5" />
                        {proof.ai_rating}/10
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {proof.ai_feedback}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TaskProofUpload;
