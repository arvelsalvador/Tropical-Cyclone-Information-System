<?php
// Historical Cyclones — results block (table + pagination + record count).
//
// Rendered in two ways:
//   1. inside cyclones.php — this file's own #cycloneResults wrapper is the
//      hook the toolbar script swaps out;
//   2. on its own when cyclones.php is requested with ?ajax=1, so typing in
//      the search box updates the results without reloading the page.
//
// Expects the including scope to provide: $rows, $total, $page, $pages,
// $search, $yearFilter, $categoryFilter, $rainfallFilter, $categoryLabels
// and $cycloneIcon. (No [data-reveal] here on purpose: elements inserted by
// JavaScript are not picked up by the reveal observer in js/main.js.)
?>
<div id="cycloneResults" data-cyclone-results>
  <div class="admin-table-wrap">
    <table class="admin-table">
      <caption class="sr-only">Historical cyclones matching the current search and filters</caption>
      <thead>
        <tr>
          <th>Cyclone</th>
          <th>Year</th>
          <th class="col-dates">Dates</th>
          <th>Category</th>
          <th>Strength (Sustained / Gust)</th>
          <th>Rainfall</th>
          <th class="col-signal">Signal</th>
          <th class="col-actions">Actions</th>
        </tr>
      </thead>
      <tbody>
        <?php if (!$rows): ?>
        <tr>
          <td colspan="8"><div class="admin-empty">No cyclones found<?php echo $search !== '' ? ' for &ldquo;' . htmlspecialchars($search) . '&rdquo;' : ''; echo ($yearFilter !== '' || $categoryFilter !== '' || $rainfallFilter !== '') ? ' with the current filters' : ''; ?>.</div></td>
        </tr>
        <?php else: ?>
        <?php foreach ($rows as $row): ?>
        <?php
          $catCode  = $row['highest_category'];
          $catLabel = $categoryLabels[$catCode] ?? '';
        ?>
        <tr>
          <td>
            <div class="admin-cyclone-cell">
              <span class="admin-cyclone-icon"><img src="<?php echo $cycloneIcon; ?>" alt="" width="36" height="36" loading="lazy" decoding="async"></span>
              <div>
                <div class="cell-strong"><?php echo htmlspecialchars(cyclone_name($row['local_name'])); ?></div>
                <?php if ($row['international_name']): ?>
                  <div class="cell-sub"><?php echo htmlspecialchars($row['international_name']); ?></div>
                <?php endif; ?>
              </div>
            </div>
          </td>
          <td><?php echo htmlspecialchars((string) $row['year']); ?></td>
          <td class="col-dates"><?php echo format_date_range($row['date_start'], $row['date_end']); ?></td>
          <td>
            <?php if ($catLabel !== ''): ?>
              <?php echo htmlspecialchars($catLabel); ?>
            <?php else: ?>
              &mdash;
            <?php endif; ?>
          </td>
          <td><?php echo strength_text($row['highest_strength']); ?></td>
          <td><?php echo ($row['rainfall_category'] ?? '') !== '' ? htmlspecialchars($row['rainfall_category']) : '&mdash;'; ?></td>
          <td class="col-signal">
            <?php echo signal_chip($row); ?>
          </td>
          <td class="col-actions">
            <div class="row-menu">
              <button type="button" class="row-menu-btn" aria-haspopup="true" aria-expanded="false" aria-label="Actions for <?php echo htmlspecialchars(cyclone_name($row['local_name']) . ' (' . $row['year'] . ')'); ?>">
                <i class="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i>
              </button>
              <div class="row-menu-list" hidden>
                <a class="row-menu-item" href="cyclone-form.php?id=<?php echo (int) $row['id']; ?>">
                  <i class="fa-solid fa-pen" aria-hidden="true"></i>
                  Edit
                </a>
                <a class="row-menu-item row-menu-item--danger" href="cyclone-delete.php?id=<?php echo (int) $row['id']; ?>">
                  <i class="fa-solid fa-trash" aria-hidden="true"></i>
                  Delete
                </a>
              </div>
            </div>
          </td>
        </tr>
        <?php endforeach; ?>
        <?php endif; ?>
      </tbody>
    </table>
  </div>

  <?php if ($pages > 1): ?>
  <div class="admin-pagination">
    <a class="admin-page-link<?php echo $page <= 1 ? ' admin-page-link--disabled' : ''; ?>"
       href="<?php echo page_link(max(1, $page - 1), $search, $yearFilter, $categoryFilter, $rainfallFilter); ?>">&lsaquo; Prev</a>
    <?php
    if ($pages <= 9) {
        $pageNumbers = range(1, $pages);
    } else {
        $pageNumbers = [1];
        $start = max(2, $page - 1);
        $end = min($pages - 1, $page + 1);
        if ($start > 2) $pageNumbers[] = '...';
        for ($p = $start; $p <= $end; $p++) $pageNumbers[] = $p;
        if ($end < $pages - 1) $pageNumbers[] = '...';
        $pageNumbers[] = $pages;
    }
    foreach ($pageNumbers as $p):
        if ($p === '...'):
    ?>
      <span class="admin-page-ellipsis">&hellip;</span>
    <?php else: ?>
      <a class="admin-page-link<?php echo $p === $page ? ' admin-page-link--active' : ''; ?>"
         href="<?php echo page_link($p, $search, $yearFilter, $categoryFilter, $rainfallFilter); ?>"><?php echo $p; ?></a>
    <?php endif; endforeach; ?>
    <a class="admin-page-link<?php echo $page >= $pages ? ' admin-page-link--disabled' : ''; ?>"
       href="<?php echo page_link(min($pages, $page + 1), $search, $yearFilter, $categoryFilter, $rainfallFilter); ?>">Next &rsaquo;</a>
  </div>
  <?php endif; ?>

  <p class="admin-page-info" role="status">
    <?php echo $total; ?> cyclone<?php echo $total === 1 ? '' : 's'; ?> on record
    &middot; page <?php echo $page; ?> of <?php echo $pages; ?>
  </p>
</div>
