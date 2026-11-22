namespace PersonalHub.Api.Features.Settings;
public class AppSetting
{
    public string Key { get; set; } = "";
    public string ValueJson { get; set; } = "null";
    public DateTime UpdatedAt { get; set; }
}
public class SchemaMetadata
{
    public string Key { get; set; } = "";
    public string Value { get; set; } = "";
}
