"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageIcon, Star, Upload } from "lucide-react";
import { toast } from "sonner";

import { galleryService } from "@/services/api";
import { formatDate } from "@/lib/utils";
import type { GalleryCategory, GalleryImage } from "@/types";
import {
  EmptyState,
  ErrorState,
  FileUpload,
  FiltersBar,
  PageHeader,
  SearchBar,
  StatusChip,
  TableSkeleton,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const CATEGORIES: GalleryCategory[] = [
  "Event Highlights",
  "Speakers",
  "Stalls",
  "Students",
  "Awards",
  "Workshops",
];

export function GalleryView() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [albumFilter, setAlbumFilter] = useState("all");
  const [featuredIds, setFeaturedIds] = useState<Set<string>>(new Set(["gal-001", "gal-003"]));
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState<GalleryCategory>("Event Highlights");
  const [uploadAlbum, setUploadAlbum] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["gallery"],
    queryFn: () => galleryService.getAll(),
  });

  const uploadMutation = useMutation({
    mutationFn: () =>
      galleryService.create({
        title: uploadTitle || uploadFiles[0]?.name || "Untitled",
        imageUrl: "/images/gallery/placeholder.jpg",
        category: uploadCategory,
        eventName: uploadAlbum || undefined,
        uploadedBy: "usr-004",
        isPublished: false,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery"] });
      toast.success("Image uploaded successfully");
      setUploadOpen(false);
      setUploadFiles([]);
      setUploadTitle("");
      setUploadAlbum("");
    },
    onError: () => toast.error("Upload failed"),
  });

  const albums = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.map((i) => i.eventName).filter(Boolean))] as string[];
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase();
    return data.filter((img) => {
      const matchesSearch =
        !q ||
        img.title.toLowerCase().includes(q) ||
        img.eventName?.toLowerCase().includes(q);
      const matchesCategory = categoryFilter === "all" || img.category === categoryFilter;
      const matchesAlbum = albumFilter === "all" || img.eventName === albumFilter;
      return matchesSearch && matchesCategory && matchesAlbum;
    });
  }, [data, search, categoryFilter, albumFilter]);

  const featured = filtered.filter((img) => featuredIds.has(img.id));
  const gridImages = filtered.filter((img) => !featuredIds.has(img.id));

  const toggleFeatured = (id: string) => {
    setFeaturedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    toast.success("Featured status updated");
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Gallery" description="Manage event photos and media." />
        <TableSkeleton rows={4} columns={4} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Gallery" />
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gallery"
        description="Upload, categorize, and feature event photos across albums."
        actions={
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Upload className="h-4 w-4" />
                Upload
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Upload Images</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <FileUpload
                  value={uploadFiles}
                  onChange={setUploadFiles}
                  accept="image/*"
                  multiple
                  maxFiles={10}
                  maxSize={5 * 1024 * 1024}
                  label="Drop images here"
                  description="PNG, JPG up to 5MB each"
                />
                <div className="space-y-2">
                  <Label htmlFor="upload-title">Title</Label>
                  <Input
                    id="upload-title"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="Image title"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={uploadCategory}
                      onValueChange={(v) => setUploadCategory(v as GalleryCategory)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="upload-album">Album / Event</Label>
                    <Input
                      id="upload-album"
                      value={uploadAlbum}
                      onChange={(e) => setUploadAlbum(e.target.value)}
                      placeholder="Event name"
                    />
                  </div>
                </div>
                <Button
                  className="w-full"
                  disabled={uploadFiles.length === 0 || uploadMutation.isPending}
                  onClick={() => uploadMutation.mutate()}
                >
                  Upload {uploadFiles.length > 0 ? `(${uploadFiles.length})` : ""}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search gallery..."
          containerClassName="max-w-full lg:max-w-md"
        />
      </div>

      <FiltersBar
        filters={[
          {
            id: "category",
            label: "Category",
            value: categoryFilter,
            onChange: setCategoryFilter,
            options: CATEGORIES.map((c) => ({ label: c, value: c })),
          },
          {
            id: "album",
            label: "Album",
            value: albumFilter,
            onChange: setAlbumFilter,
            options: albums.map((a) => ({ label: a, value: a })),
          },
        ]}
        onClearAll={() => {
          setCategoryFilter("all");
          setAlbumFilter("all");
        }}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="No images found"
          description="Upload photos or adjust your filters."
          action={{ label: "Upload images", onClick: () => setUploadOpen(true) }}
        />
      ) : (
        <>
          {featured.length > 0 && (
            <section className="space-y-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                Featured Images
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {featured.map((img) => (
                  <GalleryCard
                    key={img.id}
                    image={img}
                    featured
                    onToggleFeatured={() => toggleFeatured(img.id)}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">All Images</h2>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {gridImages.map((img) => (
                <GalleryCard
                  key={img.id}
                  image={img}
                  featured={featuredIds.has(img.id)}
                  onToggleFeatured={() => toggleFeatured(img.id)}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function GalleryCard({
  image,
  featured,
  onToggleFeatured,
}: {
  image: GalleryImage;
  featured: boolean;
  onToggleFeatured: () => void;
}) {
  return (
    <Card className="group overflow-hidden">
      <div className="relative aspect-[4/3] bg-muted">
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <ImageIcon className="h-12 w-12 opacity-30" />
        </div>
        <Button
          variant="secondary"
          size="icon"
          className={cn(
            "absolute right-2 top-2 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100",
            featured && "opacity-100"
          )}
          onClick={onToggleFeatured}
          aria-label={featured ? "Remove from featured" : "Mark as featured"}
        >
          <Star className={cn("h-4 w-4", featured && "fill-amber-400 text-amber-400")} />
        </Button>
      </div>
      <CardContent className="p-3 space-y-2">
        <p className="truncate text-sm font-medium">{image.title}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-xs">{image.category}</Badge>
          <StatusChip status={image.isPublished ? "Published" : "Draft"} dot={false} />
        </div>
        {image.eventName && (
          <p className="truncate text-xs text-muted-foreground">{image.eventName}</p>
        )}
        <p className="text-xs text-muted-foreground">{formatDate(image.uploadedAt)}</p>
      </CardContent>
    </Card>
  );
}
