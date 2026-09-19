# CIM65 CAD IA · AutoCAD 2027 AppBundle

Segunda etapa del motor CAD. Este complemento está pensado para Autodesk APS Automation API con **AutoCAD 2027 / Autodesk.AutoCAD+26_0 / .NET 10**.

## Flujo previsto

1. La web convierte la instrucción en un `job.json` validado.
2. APS Automation abre AutoCAD 2027.
3. El AppBundle ejecuta el comando `CIM65GENERATE`.
4. El comando genera capas, ejes, zapatas, columnas y sólidos 3D.
5. AutoCAD guarda `output.dwg`.
6. El backend devuelve el DWG a CIM65 CAD IA.

## Estructura del ZIP

```
CIM65Cad.bundle/
  PackageContents.xml
  Contents/
    CIM65CadPlugin.dll
```

## Compilación

- Visual Studio 2026
- .NET 10
- AutoCAD/ObjectARX 2027 SDK
- Definir la propiedad MSBuild `AutoCADSdkDir` apuntando a la carpeta que contiene:
  - AcCoreMgd.dll
  - AcDbMgd.dll
  - AcMgd.dll
- Las referencias de AutoCAD están configuradas con `Private=false` para no copiarlas dentro del bundle.

Este código es una base de automatización. Antes de utilizar geometría para construcción deben agregarse reglas estructurales y revisión normativa específicas del proyecto.
