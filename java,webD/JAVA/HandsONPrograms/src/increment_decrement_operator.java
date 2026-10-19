public class increment_decrement_operator {
    public static void main(String[] args) {
 /*     int i = 56 ;
        System.out.println(i++);
        System.out.println(i);
        System.out.println(++i);*/
        /*
        int a = 54;
        int b = ++a;
        int c = ++b;
        System.out.println(b);
        System.out.println(a);*/
        int y = 7;
        int x = ++y*8;
        System.out.println(x);
        char ch = 'a';
        System.out.println(++ch);
    }
}

package in.sp.update;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;


public class demo {

    public static void main(String[] args) throws Exception {
        Class.forName("com.mysql.cj.jdbc.Driver");
        Connection con = DriverManager.getConnection("jdbc:mysql://localhost:3306/jdbc_db", "root", "root");
        PreparedStatement ps = con.prepareStatement("insert into register values('Ajay', 'Ajay@gmail.com', 'deepak123', 'male', 'Chandigarh')");
        int i = ps.executeUpdate();

        if(i > 0) {
            System.out.println("Success");
        } else {
            System.out.println("Fault occurred");
        }
    }
}

    }

}
