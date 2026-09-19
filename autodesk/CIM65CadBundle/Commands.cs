using Autodesk.AutoCAD.ApplicationServices.Core;
using Autodesk.AutoCAD.Colors;
using Autodesk.AutoCAD.DatabaseServices;
using Autodesk.AutoCAD.Geometry;
using Autodesk.AutoCAD.Runtime;
using System.Text.Json;

[assembly: CommandClass(typeof(CIM65CadPlugin.Commands))]

namespace CIM65CadPlugin;

public sealed class CadJob
{
    public string Type { get; set; } = "nave_industrial";
    public double Width { get; set; } = 24;
    public double Length { get; set; } = 36;
    public double Height { get; set; } = 8;
    public double Bay { get; set; } = 6;
    public double FootingW { get; set; } = 2;
    public double FootingL { get; set; } = 2;
    public double FootingT { get; set; } = .5;
    public double ColumnW { get; set; } = .30;
    public double ColumnD { get; set; } = .30;
    public double RoofT { get; set; } = .15;
}

public static class Commands
{
    [CommandMethod("CIM65GENERATE", CommandFlags.Modal)]
    public static void Generate()
    {
        var doc = Application.DocumentManager.MdiActiveDocument
                  ?? throw new InvalidOperationException("No active AutoCAD document.");
        var db = doc.Database;
        var ed = doc.Editor;

        var jsonPath = Path.Combine(Environment.CurrentDirectory, "job.json");
        if (!File.Exists(jsonPath))
            throw new FileNotFoundException("job.json was not found.", jsonPath);

        var job = JsonSerializer.Deserialize<CadJob>(
            File.ReadAllText(jsonPath),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
        ) ?? new CadJob();

        Validate(job);

        using (var tr = db.TransactionManager.StartTransaction())
        {
            var bt = (BlockTable)tr.GetObject(db.BlockTableId, OpenMode.ForRead);
            var ms = (BlockTableRecord)tr.GetObject(bt[BlockTableRecord.ModelSpace], OpenMode.ForWrite);

            var layerOutline = EnsureLayer(db, tr, "CIM65_CONTORNO", 4);
            var layerAxes = EnsureLayer(db, tr, "CIM65_EJES", 8);
            var layerFootings = EnsureLayer(db, tr, "CIM65_CIMENTACION", 1);
            var layerColumns = EnsureLayer(db, tr, "CIM65_COLUMNAS", 7);
            var layerRoof = EnsureLayer(db, tr, "CIM65_CUBIERTA", 3);

            AddRectangle(ms, tr, layerOutline, 0, 0, job.Width, job.Length, 0);

            int nx = Math.Max(2, (int)Math.Round(job.Width / job.Bay) + 1);
            int ny = Math.Max(2, (int)Math.Round(job.Length / job.Bay) + 1);
            double dx = job.Width / (nx - 1);
            double dy = job.Length / (ny - 1);

            for (int i = 0; i < nx; i++)
                AddLine(ms, tr, layerAxes, new Point3d(i * dx, 0, 0), new Point3d(i * dx, job.Length, 0));
            for (int j = 0; j < ny; j++)
                AddLine(ms, tr, layerAxes, new Point3d(0, j * dy, 0), new Point3d(job.Width, j * dy, 0));

            for (int i = 0; i < nx; i++)
            for (int j = 0; j < ny; j++)
            {
                double x = i * dx;
                double y = j * dy;

                var footing = new Solid3d();
                footing.SetDatabaseDefaults();
                footing.LayerId = layerFootings;
                footing.CreateBox(job.FootingW, job.FootingL, job.FootingT);
                footing.TransformBy(Matrix3d.Displacement(
                    new Vector3d(x - job.FootingW / 2, y - job.FootingL / 2, -job.FootingT)));
                ms.AppendEntity(footing);
                tr.AddNewlyCreatedDBObject(footing, true);

                var column = new Solid3d();
                column.SetDatabaseDefaults();
                column.LayerId = layerColumns;
                column.CreateBox(job.ColumnW, job.ColumnD, job.Height);
                column.TransformBy(Matrix3d.Displacement(
                    new Vector3d(x - job.ColumnW / 2, y - job.ColumnD / 2, 0)));
                ms.AppendEntity(column);
                tr.AddNewlyCreatedDBObject(column, true);
            }

            var roof = new Solid3d();
            roof.SetDatabaseDefaults();
            roof.LayerId = layerRoof;
            roof.CreateBox(job.Width, job.Length, job.RoofT);
            roof.TransformBy(Matrix3d.Displacement(new Vector3d(0, 0, job.Height)));
            ms.AppendEntity(roof);
            tr.AddNewlyCreatedDBObject(roof, true);

            tr.Commit();
        }

        var outputPath = Path.Combine(Environment.CurrentDirectory, "output.dwg");
        db.SaveAs(outputPath, DwgVersion.AC1032);
        ed.WriteMessage($"\nCIM65 CAD IA: DWG generated at {outputPath}");
    }

    private static void Validate(CadJob j)
    {
        if (j.Width <= 0 || j.Length <= 0 || j.Height <= 0 || j.Bay <= 0)
            throw new ArgumentOutOfRangeException(nameof(j), "Dimensions must be positive.");
        if (j.Width > 2000 || j.Length > 2000 || j.Height > 200)
            throw new ArgumentOutOfRangeException(nameof(j), "Dimensions exceed configured safety bounds.");
    }

    private static ObjectId EnsureLayer(Database db, Transaction tr, string name, short colorIndex)
    {
        var lt = (LayerTable)tr.GetObject(db.LayerTableId, OpenMode.ForRead);
        if (lt.Has(name)) return lt[name];

        lt.UpgradeOpen();
        var rec = new LayerTableRecord
        {
            Name = name,
            Color = Color.FromColorIndex(ColorMethod.ByAci, colorIndex)
        };
        var id = lt.Add(rec);
        tr.AddNewlyCreatedDBObject(rec, true);
        return id;
    }

    private static void AddLine(BlockTableRecord ms, Transaction tr, ObjectId layer, Point3d a, Point3d b)
    {
        var line = new Line(a, b) { LayerId = layer };
        ms.AppendEntity(line);
        tr.AddNewlyCreatedDBObject(line, true);
    }

    private static void AddRectangle(BlockTableRecord ms, Transaction tr, ObjectId layer,
        double x1, double y1, double x2, double y2, double z)
    {
        var pl = new Polyline(4) { LayerId = layer, Closed = true, Elevation = z };
        pl.AddVertexAt(0, new Point2d(x1, y1), 0, 0, 0);
        pl.AddVertexAt(1, new Point2d(x2, y1), 0, 0, 0);
        pl.AddVertexAt(2, new Point2d(x2, y2), 0, 0, 0);
        pl.AddVertexAt(3, new Point2d(x1, y2), 0, 0, 0);
        ms.AppendEntity(pl);
        tr.AddNewlyCreatedDBObject(pl, true);
    }
}