export default function LinkFilters({ filters, defaults, onApply, disabled }) {
  function submit(event) {
    event.preventDefault();
    onApply(Object.fromEntries(new FormData(event.currentTarget)));
  }

  return (
    <form className="link-filters" onSubmit={submit} aria-label="Link filters">
      <fieldset disabled={disabled}>
        <label>Search links<input name="search" type="search" maxLength={100} defaultValue={filters.search} placeholder="Code, destination or tag" /></label>
        <label>Status<select name="status" defaultValue={filters.status}>
          <option value="">All statuses</option><option value="active">Active</option><option value="disabled">Disabled</option>
          <option value="expired">Expired</option><option value="security-blocked">Security blocked</option>
        </select></label>
        <label>Tag<input name="tag" maxLength={32} defaultValue={filters.tag} placeholder="Exact tag" /></label>
        <label>Created from (UTC)<input name="createdFrom" type="date" defaultValue={filters.createdFrom} /></label>
        <label>Created through (UTC)<input name="createdTo" type="date" defaultValue={filters.createdTo} /></label>
        <label>Sort by<select name="sort" defaultValue={filters.sort}>
          <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
          <option value="updated">Recently updated</option><option value="expiration">Latest expiration</option>
          <option value="code">Short code</option>
        </select></label>
        <label>Links per page<select name="limit" defaultValue={filters.limit}>
          {[5, 10, 25, 50].map((limit) => <option key={limit} value={limit}>{limit}</option>)}
        </select></label>
        <div className="filter-actions">
          <button className="primary-btn" type="submit">Apply filters</button>
          <button className="secondary-btn" type="button" onClick={() => onApply(defaults, true)}>Clear filters</button>
        </div>
      </fieldset>
    </form>
  );
}
