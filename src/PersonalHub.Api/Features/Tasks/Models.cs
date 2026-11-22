using PersonalHub.Api.Common;
using PersonalHub.Api.Features.Dashboard;
namespace PersonalHub.Api.Features.Tasks;

public class TaskColumn : Entity
{
    public string Name { get; set; } = "";
    public string Color { get; set; } = "#cc0000";
    public int SortOrder { get; set; }
    public bool IsDone { get; set; }
    public int? WipLimit { get; set; }
    public bool IsArchived { get; set; }
}
public class HubTask : Entity
{
    public Guid ColumnId { get; set; }
    public string Title { get; set; } = "";
    public string DescriptionMarkdown { get; set; } = "";
    public string Priority { get; set; } = "none";
    public DateOnly? DueDate { get; set; }
    public TimeOnly? DueTime { get; set; }
    public DateOnly? StartDate { get; set; }
    public DateTime? CompletedAt { get; set; }
    public bool IsArchived { get; set; }
    public int SortOrder { get; set; }
    public Guid? LastActiveColumnId { get; set; }
    public Guid? RelatedDashboardItemId { get; set; }
    public List<Tag> Tags { get; set; } = [];
    public List<ChecklistItem> Checklist { get; set; } = [];
    public List<TaskLink> Links { get; set; } = [];
}
public class ChecklistItem : Entity
{
    public Guid TaskId { get; set; }
    public string Title { get; set; } = "";
    public bool IsChecked { get; set; }
    public int SortOrder { get; set; }
}
public class TaskLink : Entity
{
    public Guid TaskId { get; set; }
    public string Title { get; set; } = "";
    public string Url { get; set; } = "";
    public int SortOrder { get; set; }
}
