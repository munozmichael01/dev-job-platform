#!/usr/bin/env python3
"""
Script para generar reporte de métricas por canales
Analiza el CSV de datos enriquecidos y genera top 25 por:
- Regiones
- Ciudades
- Job Titles
- Areas
- Sectores
- Combinaciones (JobTitle/Región, Sector/Ciudad, etc.)
"""

import pandas as pd
import sys
from pathlib import Path

def load_data(csv_path):
    """Carga el CSV de métricas enriquecidas"""
    print(f"📁 Cargando datos desde: {csv_path}")
    df = pd.read_csv(csv_path)
    print(f"✅ Cargados {len(df):,} registros")
    return df

def aggregate_by_channel(df, group_cols, name):
    """Agrega métricas por canal y columnas específicas"""
    print(f"\n🔄 Procesando: {name}")

    # Agrupar y sumar métricas
    agg_dict = {
        'ListImpressions': 'sum',
        'DetailViews': 'sum',
        'PageVisits': 'sum',
        'Applications': 'sum',
        'TotalEngagements': 'sum',
        'TotalTouchpoints': 'sum',
        'OfferId': 'nunique'  # Ofertas únicas
    }

    result = df.groupby(group_cols + ['Source']).agg(agg_dict).reset_index()
    result.rename(columns={'OfferId': 'UniqueOffers'}, inplace=True)

    # Calcular ratios
    result['ConversionRate'] = (result['Applications'] / result['TotalTouchpoints'] * 100).round(2)
    result['EngagementRate'] = (result['TotalEngagements'] / result['TotalTouchpoints'] * 100).round(2)

    # Ordenar por aplicaciones descendente
    result = result.sort_values('Applications', ascending=False)

    return result

def generate_report(csv_path):
    """Genera el reporte completo"""
    df = load_data(csv_path)

    # Limpiar datos vacíos
    df = df[df['Source'].notna() & (df['Source'] != '')]

    reports = {}

    # 1. TOP 25 REGIONES
    print("\n" + "="*80)
    print("📊 TOP 25 REGIONES POR CANAL")
    print("="*80)
    regions = aggregate_by_channel(df[df['Region'].notna()], ['Region'], 'Regiones')
    reports['regiones'] = regions.head(25)
    print(reports['regiones'].to_string(index=False))

    # 2. TOP 25 CIUDADES
    print("\n" + "="*80)
    print("📊 TOP 25 CIUDADES POR CANAL")
    print("="*80)
    cities = aggregate_by_channel(df[df['City'].notna()], ['City', 'Region'], 'Ciudades')
    reports['ciudades'] = cities.head(25)
    print(reports['ciudades'].to_string(index=False))

    # 3. TOP 25 JOB TITLES
    print("\n" + "="*80)
    print("📊 TOP 25 JOB TITLES POR CANAL")
    print("="*80)
    titles = aggregate_by_channel(df[df['JobTitle'].notna()], ['JobTitle'], 'Job Titles')
    reports['job_titles'] = titles.head(25)
    print(reports['job_titles'].to_string(index=False))

    # 4. TOP 25 AREAS
    print("\n" + "="*80)
    print("📊 TOP 25 AREAS POR CANAL")
    print("="*80)
    areas = aggregate_by_channel(df[df['Area'].notna()], ['Area'], 'Areas')
    reports['areas'] = areas.head(25)
    print(reports['areas'].to_string(index=False))

    # 5. TOP 25 SECTORES
    print("\n" + "="*80)
    print("📊 TOP 25 SECTORES POR CANAL")
    print("="*80)
    sectors = aggregate_by_channel(df[df['Sector'].notna()], ['Sector'], 'Sectores')
    reports['sectores'] = sectors.head(25)
    print(reports['sectores'].to_string(index=False))

    # 6. TOP 25 JOB TITLE / REGIONES
    print("\n" + "="*80)
    print("📊 TOP 25 JOB TITLE / REGIONES POR CANAL")
    print("="*80)
    title_region = aggregate_by_channel(
        df[(df['JobTitle'].notna()) & (df['Region'].notna())],
        ['JobTitle', 'Region'],
        'JobTitle/Regiones'
    )
    reports['jobtitle_region'] = title_region.head(25)
    print(reports['jobtitle_region'].to_string(index=False))

    # 7. TOP 25 JOB TITLE / CIUDADES
    print("\n" + "="*80)
    print("📊 TOP 25 JOB TITLE / CIUDADES POR CANAL")
    print("="*80)
    title_city = aggregate_by_channel(
        df[(df['JobTitle'].notna()) & (df['City'].notna())],
        ['JobTitle', 'City', 'Region'],
        'JobTitle/Ciudades'
    )
    reports['jobtitle_city'] = title_city.head(25)
    print(reports['jobtitle_city'].to_string(index=False))

    # 8. TOP 25 AREA / REGIONES
    print("\n" + "="*80)
    print("📊 TOP 25 AREA / REGIONES POR CANAL")
    print("="*80)
    area_region = aggregate_by_channel(
        df[(df['Area'].notna()) & (df['Region'].notna())],
        ['Area', 'Region'],
        'Area/Regiones'
    )
    reports['area_region'] = area_region.head(25)
    print(reports['area_region'].to_string(index=False))

    # 9. TOP 25 AREA / CIUDADES
    print("\n" + "="*80)
    print("📊 TOP 25 AREA / CIUDADES POR CANAL")
    print("="*80)
    area_city = aggregate_by_channel(
        df[(df['Area'].notna()) & (df['City'].notna())],
        ['Area', 'City', 'Region'],
        'Area/Ciudades'
    )
    reports['area_city'] = area_city.head(25)
    print(reports['area_city'].to_string(index=False))

    # 10. TOP 25 SECTOR / REGIONES
    print("\n" + "="*80)
    print("📊 TOP 25 SECTOR / REGIONES POR CANAL")
    print("="*80)
    sector_region = aggregate_by_channel(
        df[(df['Sector'].notna()) & (df['Region'].notna())],
        ['Sector', 'Region'],
        'Sector/Regiones'
    )
    reports['sector_region'] = sector_region.head(25)
    print(reports['sector_region'].to_string(index=False))

    # 11. TOP 25 SECTOR / CIUDADES
    print("\n" + "="*80)
    print("📊 TOP 25 SECTOR / CIUDADES POR CANAL")
    print("="*80)
    sector_city = aggregate_by_channel(
        df[(df['Sector'].notna()) & (df['City'].notna())],
        ['Sector', 'City', 'Region'],
        'Sector/Ciudades'
    )
    reports['sector_city'] = sector_city.head(25)
    print(reports['sector_city'].to_string(index=False))

    # Guardar reportes en Excel
    output_path = Path(csv_path).parent / 'REPORTE_METRICAS_CANALES_TOP25.xlsx'
    print(f"\n💾 Guardando reporte en: {output_path}")

    with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
        for sheet_name, data in reports.items():
            data.to_excel(writer, sheet_name=sheet_name[:31], index=False)  # Excel limit 31 chars

    print(f"✅ Reporte generado exitosamente!")
    print(f"\n📊 RESUMEN:")
    print(f"   - Total registros analizados: {len(df):,}")
    print(f"   - Canales únicos (Source): {df['Source'].nunique()}")
    print(f"   - Ofertas únicas: {df['OfferId'].nunique():,}")
    print(f"   - Regiones únicas: {df['Region'].nunique()}")
    print(f"   - Ciudades únicas: {df['City'].nunique()}")
    print(f"   - Job Titles únicos: {df['JobTitle'].nunique():,}")
    print(f"   - Areas únicas: {df['Area'].nunique()}")
    print(f"   - Sectores únicos: {df['Sector'].nunique()}")

if __name__ == '__main__':
    csv_path = r'C:\Dev\job-platform\Queries\METRICAS POR OFERTA Y CANALES ULTIMOS 30 DIAS - DATOS ENRIQUECIDOS.csv'

    if not Path(csv_path).exists():
        print(f"❌ Error: No se encontró el archivo: {csv_path}")
        sys.exit(1)

    generate_report(csv_path)
