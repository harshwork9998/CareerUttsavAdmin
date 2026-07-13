"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, Save, Send } from "lucide-react";
import { toast } from "sonner";

import { blogsService } from "@/services/api";
import type { BlogStatus } from "@/types";
import {
  CardSkeleton,
  ErrorState,
  PageHeader,
  RichTextEditor,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface BlogFormProps {
  blogId?: string;
}

interface BlogFormState {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  tags: string;
  status: BlogStatus;
  metaTitle: string;
  metaDescription: string;
  author: string;
  authorId: string;
  readTimeMinutes: number;
}

const defaultState: BlogFormState = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  coverImage: "",
  tags: "",
  status: "Draft",
  metaTitle: "",
  metaDescription: "",
  author: "Vikram Singh",
  authorId: "usr-004",
  readTimeMinutes: 5,
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function BlogForm({ blogId }: BlogFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const isEdit = Boolean(blogId);
  const initialPreview = searchParams.get("preview") === "1";

  const [form, setForm] = useState<BlogFormState>(defaultState);
  const [tab, setTab] = useState(initialPreview ? "preview" : "edit");

  const { data: blog, isLoading, isError, refetch } = useQuery({
    queryKey: ["blogs", blogId],
    queryFn: () => blogsService.getById(blogId!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (blog) {
      setForm({
        title: blog.title,
        slug: blog.slug,
        excerpt: blog.excerpt,
        content: blog.content,
        coverImage: blog.coverImage ?? "",
        tags: blog.tags.join(", "),
        status: blog.status,
        metaTitle: blog.title,
        metaDescription: blog.excerpt,
        author: blog.author,
        authorId: blog.authorId,
        readTimeMinutes: blog.readTimeMinutes,
      });
    }
  }, [blog]);

  const saveMutation = useMutation({
    mutationFn: async (status: BlogStatus) => {
      const payload = {
        title: form.title,
        slug: form.slug || slugify(form.title),
        excerpt: form.excerpt,
        content: form.content,
        coverImage: form.coverImage || undefined,
        author: form.author,
        authorId: form.authorId,
        status,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        readTimeMinutes: form.readTimeMinutes,
        publishedAt: status === "Published" ? new Date().toISOString() : undefined,
      };

      if (isEdit && blogId) {
        return blogsService.update(blogId, payload);
      }
      return blogsService.create(payload);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["blogs"] });
      toast.success(isEdit ? "Blog updated" : "Blog created");
      if (!isEdit) router.push(`/blogs/${saved.id}/edit`);
    },
    onError: () => toast.error("Failed to save blog"),
  });

  const updateField = <K extends keyof BlogFormState>(key: K, value: BlogFormState[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "title" && !isEdit) {
        next.slug = slugify(value as string);
        next.metaTitle = value as string;
      }
      if (key === "excerpt") {
        next.metaDescription = value as string;
      }
      return next;
    });
  };

  if (isEdit && isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit Blog" />
        <CardSkeleton count={2} />
      </div>
    );
  }

  if (isEdit && isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit Blog" />
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEdit ? "Edit Blog Post" : "New Blog Post"}
        description="Write content, configure SEO, and preview before publishing."
        breadcrumbs={[
          { label: "Blogs", href: "/blogs" },
          { label: isEdit ? "Edit" : "New" },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="gap-2"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate("Draft")}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Draft
            </Button>
            <Button
              className="gap-2"
              disabled={saveMutation.isPending || !form.title}
              onClick={() => saveMutation.mutate("Published")}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Publish
            </Button>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="edit">Editor</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="preview" className="gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="mt-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  placeholder="Post title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => updateField("slug", e.target.value)}
                  placeholder="url-friendly-slug"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="excerpt">Excerpt</Label>
                <Textarea
                  id="excerpt"
                  value={form.excerpt}
                  onChange={(e) => updateField("excerpt", e.target.value)}
                  placeholder="Brief summary for listings and SEO"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Content</Label>
                <RichTextEditor
                  value={form.content}
                  onChange={(v) => updateField("content", v)}
                  minHeight={280}
                />
              </div>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={form.status}
                      onValueChange={(v) => updateField("status", v as BlogStatus)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Draft">Draft</SelectItem>
                        <SelectItem value="Published">Published</SelectItem>
                        <SelectItem value="Archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cover">Cover Image URL</Label>
                    <Input
                      id="cover"
                      value={form.coverImage}
                      onChange={(e) => updateField("coverImage", e.target.value)}
                      placeholder="/images/blogs/..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tags">Tags</Label>
                    <Input
                      id="tags"
                      value={form.tags}
                      onChange={(e) => updateField("tags", e.target.value)}
                      placeholder="Engineering, Career Tips"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="readTime">Read Time (minutes)</Label>
                    <Input
                      id="readTime"
                      type="number"
                      min={1}
                      value={form.readTimeMinutes}
                      onChange={(e) =>
                        updateField("readTimeMinutes", Number(e.target.value) || 5)
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="seo" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>SEO Settings</CardTitle>
              <CardDescription>
                Optimize how this post appears in search engines and social shares.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-2xl">
              <div className="space-y-2">
                <Label htmlFor="metaTitle">Meta Title</Label>
                <Input
                  id="metaTitle"
                  value={form.metaTitle}
                  onChange={(e) => updateField("metaTitle", e.target.value)}
                  maxLength={60}
                />
                <p className="text-xs text-muted-foreground">
                  {form.metaTitle.length}/60 characters
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="metaDescription">Meta Description</Label>
                <Textarea
                  id="metaDescription"
                  value={form.metaDescription}
                  onChange={(e) => updateField("metaDescription", e.target.value)}
                  rows={4}
                  maxLength={160}
                />
                <p className="text-xs text-muted-foreground">
                  {form.metaDescription.length}/160 characters
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm font-medium text-primary">
                  {form.metaTitle || form.title || "Page Title"}
                </p>
                <p className="text-xs text-green-700 dark:text-green-400">
                  careerutsav.com/blogs/{form.slug || "your-slug"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {form.metaDescription || form.excerpt || "Meta description preview..."}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              {form.coverImage && (
                <div className="mb-6 aspect-video overflow-hidden rounded-lg bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.coverImage}
                    alt={form.title}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div className="mb-4 flex flex-wrap gap-2">
                {form.tags.split(",").map((t) => t.trim()).filter(Boolean).map((tag) => (
                  <Badge key={tag} variant="secondary">{tag}</Badge>
                ))}
              </div>
              <h2 className="text-3xl font-bold">{form.title || "Untitled Post"}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                by {form.author} · {form.readTimeMinutes} min read
              </p>
              <p className="mt-6 text-lg text-muted-foreground">{form.excerpt}</p>
              <div
                className="prose prose-sm mt-6 max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: form.content || "<p>No content yet.</p>" }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
