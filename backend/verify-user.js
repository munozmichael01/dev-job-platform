const { pool, sql } = require('./src/db/db');

(async () => {
  try {
    await pool;
    
    // Check if user 9 exists and has a Client
    const userResult = await pool.request()
      .input('UserId', sql.BigInt, 9)
      .query(`
        SELECT u.Id, u.Email, u.FirstName, u.LastName, u.Company, 
               c.Id as ClientId, c.Name as ClientName
        FROM Users u
        LEFT JOIN Clients c ON u.Id = c.UserId
        WHERE u.Id = @UserId
      `);
    
    if (userResult.recordset.length > 0) {
      const data = userResult.recordset[0];
      console.log('✅ VERIFICATION SUCCESSFUL:');
      console.log('User:', data.Email, '(ID:', data.Id + ')');
      console.log('Client ID:', data.ClientId || 'NOT FOUND');
      console.log('Client Name:', data.ClientName || 'NOT FOUND');
      
      if (data.ClientId) {
        console.log('🎉 SUCCESS: User has associated Client!');
      } else {
        console.log('❌ ISSUE: User does NOT have associated Client');
      }
    } else {
      console.log('❌ User ID 9 not found');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  process.exit();
})();