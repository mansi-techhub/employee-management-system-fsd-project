import React from "react";
import { useNavigate } from "react-router-dom";
import { clearCurrentUser, getCurrentUser } from "../auth";

function Navbar(){
const navigate = useNavigate();
const user = getCurrentUser();
const role = user?.role;
const displayName = user?.name || "User";

return(

<div className="navbar">

<h3>
Welcome, {displayName} ({role === "admin" ? "Admin" : "Employee"})
</h3>

<button
className="logout"
onClick={()=>{
clearCurrentUser();
navigate("/");
}}
>
Logout
</button>

</div>

);

}

export default Navbar;
