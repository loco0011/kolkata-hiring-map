<?php

namespace Database\Seeders;

use App\Models\Area;
use Illuminate\Database\Seeder;

class AreaSeeder extends Seeder
{
    /**
     * Canonical Kolkata hiring hubs. Keep this list curated, not user-generated.
     */
    public function run(): void
    {
        $areas = [
            ['key' => 'salt-lake-sector-v', 'label' => 'Salt Lake Sector V', 'lat' => 22.5764, 'lng' => 88.4318, 'default_zoom' => 15, 'sort_order' => 1],
            ['key' => 'rajarhat-new-town', 'label' => 'Rajarhat New Town', 'lat' => 22.5958, 'lng' => 88.4783, 'default_zoom' => 14, 'sort_order' => 2],
            ['key' => 'park-street', 'label' => 'Park Street', 'lat' => 22.5527, 'lng' => 88.3529, 'default_zoom' => 15, 'sort_order' => 3],
            ['key' => 'camac-street', 'label' => 'Camac Street', 'lat' => 22.5445, 'lng' => 88.3540, 'default_zoom' => 15, 'sort_order' => 4],
            ['key' => 'ballygunge', 'label' => 'Ballygunge', 'lat' => 22.5285, 'lng' => 88.3648, 'default_zoom' => 15, 'sort_order' => 5],
            ['key' => 'alipore', 'label' => 'Alipore', 'lat' => 22.5330, 'lng' => 88.3308, 'default_zoom' => 15, 'sort_order' => 6],
            ['key' => 'esplanade-bbd-bagh', 'label' => 'Esplanade / BBD Bagh', 'lat' => 22.5675, 'lng' => 88.3495, 'default_zoom' => 15, 'sort_order' => 7],
            ['key' => 'em-bypass', 'label' => 'EM Bypass', 'lat' => 22.5185, 'lng' => 88.3968, 'default_zoom' => 13, 'sort_order' => 8],
            ['key' => 'kasba', 'label' => 'Kasba', 'lat' => 22.5170, 'lng' => 88.3812, 'default_zoom' => 15, 'sort_order' => 9],
            ['key' => 'topsia', 'label' => 'Topsia', 'lat' => 22.5382, 'lng' => 88.3897, 'default_zoom' => 15, 'sort_order' => 10],
            ['key' => 'garia', 'label' => 'Garia', 'lat' => 22.4629, 'lng' => 88.3927, 'default_zoom' => 14, 'sort_order' => 11],
            ['key' => 'behala', 'label' => 'Behala', 'lat' => 22.4989, 'lng' => 88.3153, 'default_zoom' => 14, 'sort_order' => 12],
            ['key' => 'howrah', 'label' => 'Howrah', 'lat' => 22.5958, 'lng' => 88.2636, 'default_zoom' => 13, 'sort_order' => 13],
            ['key' => 'dum-dum', 'label' => 'Dum Dum', 'lat' => 22.6420, 'lng' => 88.4197, 'default_zoom' => 14, 'sort_order' => 14],
            ['key' => 'chinar-park', 'label' => 'Chinar Park', 'lat' => 22.6252, 'lng' => 88.4635, 'default_zoom' => 15, 'sort_order' => 15],
            ['key' => 'sector-1-salt-lake', 'label' => 'Salt Lake Sector I', 'lat' => 22.5860, 'lng' => 88.4009, 'default_zoom' => 15, 'sort_order' => 16],
            ['key' => 'jadavpur', 'label' => 'Jadavpur', 'lat' => 22.4988, 'lng' => 88.3714, 'default_zoom' => 15, 'sort_order' => 17],
            ['key' => 'tollygunge', 'label' => 'Tollygunge', 'lat' => 22.4996, 'lng' => 88.3436, 'default_zoom' => 15, 'sort_order' => 18],
        ];

        foreach ($areas as $area) {
            Area::updateOrCreate(['key' => $area['key']], $area);
        }
    }
}
