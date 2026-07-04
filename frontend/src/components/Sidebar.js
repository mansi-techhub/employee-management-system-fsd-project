import React from "react";
import { Link } from "react-router-dom";
import { getCurrentUser } from "../auth";

function Sidebar(){

const user = getCurrentUser();
const role = user?.role;

return(

<div className="sidebar">

<h2 className="logo">EMS</h2>

<ul>

<li>
<Link to={role === "admin" ? "/admin" : "/employee"}>Dashboard</Link>
</li>

{role === "admin" && (
<>
<li>
<Link to="/list">Employee List</Link>
</li>
</>
)}

<li>
<Link to="/attendance">Attendance</Link>
</li>

<li>
<Link to="/leave">Leave</Link>
</li>

<li>
<Link to="/performance">Performance</Link>
</li>

<li>
<Link to="/salary">Salary</Link>
</li>

</ul>

<div className="sidebar-footer">
<div>{user?.department || "Operations"}</div>
<div>{user?.email || ""}</div>
</div>

</div>

);

}

export default Sidebar;
