using PersonalHub.Api.Common;
namespace PersonalHub.Api.Features.Dashboard;

public class DashboardTab : Entity
{
    public string Name { get; set; } = "";
    public string IconKey { get; set; } = "lucide:folder";
    public string AccentColor { get; set; } = "#cc0000";
    public int SortOrder { get; set; }
    public bool IsHidden { get; set; }
}
public class DashboardSection : Entity
{
    public Guid TabId { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string IconKey { get; set; } = "lucide:folder";
    public string AccentColor { get; set; } = "#cc0000";
    public int SortOrder { get; set; }
    public bool IsCollapsed { get; set; }
    public string LayoutMode { get; set; } = "grid";
    public int DesktopColumns { get; set; } = 4;
    public int TabletColumns { get; set; } = 2;
    public int MobileColumns { get; set; } = 1;
    public int WidthPercent { get; set; } = 100;
}
public class DashboardItem : Entity
{
    public Guid SectionId { get; set; }
    public string ItemType { get; set; } = "compact-link";
    public string Title { get; set; } = "";
    public string? Url { get; set; }
    public string Description { get; set; } = "";
    public string IconKey { get; set; } = "lucide:link";
    public string AccentColor { get; set; } = "#cc0000";
    public bool OpenInNewTab { get; set; } = true;
    public bool IsFavorite { get; set; }
    public int SortOrder { get; set; }
    public List<Tag> Tags { get; set; } = [];
}
public class Tag : Entity
{
    public string Name { get; set; } = "";
    public string Color { get; set; } = "#cc0000";
}
public class IconAsset : Entity
{
    public string FileName { get; set; } = "";
    public string ContentType { get; set; } = "";
    public byte[] Data { get; set; } = [];
    public string Sha256 { get; set; } = "";
    public int SizeBytes { get; set; }
}
