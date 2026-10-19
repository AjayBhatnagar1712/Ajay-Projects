public class multidimensional_array {
    public static void main(String[] args) {
        // Creating a 2-D Array
        // I am creating a array with floors and rooms on the floor system.
        int [] [] flat = new int[2][3];
        flat [0] [0] = 101 ;
        flat [0] [1] = 102 ;
        flat [0] [2] = 102 ;
        flat [1] [0] = 201 ;
        flat [1] [1] = 202 ;
        flat [1] [2] = 203 ;
        for (int i = 0 ; i< flat.length ; i++){
            for (int j = 0 ; j < flat[i].length ; j++){
                System.out.print(flat[i][j]);
                System.out.print(" ");
            }
            System.out.println();
        }
    }
}